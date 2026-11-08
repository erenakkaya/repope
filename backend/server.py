import asyncio
import logging
import os
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

from db import db, client
from auth import (hash_password, verify_password, create_token, current_user, require_admin,
                  check_lock, register_failure, clear_failures, seed_admin)
from money import to_cents, fmt
from viper_client import viper
from settings_store import site_name, viper_creds, update_settings, mask
from wallet import wallet_router

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("username", ASCENDING)], name="username", unique=True),
    ],
    "transactions": [
        IndexModel([("tx_id", ASCENDING)], name="tx_id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "login_attempts": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logging.getLogger(__name__).error("ensure_indexes(%s): %s", collection, exc)


app = FastAPI()
api = APIRouter(prefix="/api")


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "role": u["role"],
        "balance": fmt(u.get("balance_cents", 0)), "blocked": u.get("blocked", False),
        "created_at": u.get("created_at"),
    }


def public_tx(t: dict) -> dict:
    return {
        "tx_id": t["tx_id"], "username": t.get("username"), "action": t["action"],
        "amount": fmt(t.get("amount_cents", 0)), "status": t.get("status"),
        "error_code": t.get("error_code"), "rolled_back": t.get("rolled_back", False),
        "balance_after": fmt(t["balance_after_cents"]) if t.get("balance_after_cents") is not None else None,
        "game_id": t.get("game_id"), "provider": t.get("provider"), "round_id": t.get("round_id"),
        "note": t.get("note"), "created_at": t.get("created_at"),
    }


# ---------- Auth ----------
class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    username = body.username.strip().lower()
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    key = f"{ip}:{username}"
    await check_lock(key)
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(body.password, user["password_hash"]):
        await register_failure(key)
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="Hesabınız kilitlenmiş. Yönetici ile iletişime geçin.")
    await clear_failures(key)
    return {"token": create_token(user["id"], user["role"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api.get("/me/transactions")
async def my_transactions(user: dict = Depends(current_user), limit: int = Query(50, ge=1, le=200)):
    txs = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [public_tx(t) for t in txs]


# ---------- Casino ----------
class GamesIn(BaseModel):
    provider: Optional[str] = None
    category: Optional[str] = None
    search: Optional[str] = Field(None, max_length=64)
    page: int = Field(1, ge=1)
    per_page: int = Field(48, ge=1, le=500)


class LaunchIn(BaseModel):
    game_id: str
    return_url: Optional[str] = None


@api.get("/casino/providers")
async def providers(user: dict = Depends(current_user)):
    return await viper("GET", "/api/v1/providers")


@api.post("/casino/games")
async def games(body: GamesIn, user: dict = Depends(current_user)):
    payload = {k: v for k, v in body.model_dump().items() if v not in (None, "")}
    return await viper("POST", "/api/v1/games", payload)


@api.post("/casino/launch")
async def launch(body: LaunchIn, user: dict = Depends(current_user)):
    payload = {"player_id": user["id"], "currency": "TRY", "game_id": body.game_id, "lang": "tr", "country": "TR"}
    if body.return_url and body.return_url.startswith(("http://", "https://")):
        payload["return_url"] = body.return_url
    return await viper("POST", "/api/v1/launch", payload)


# ---------- Admin: players ----------
class CreateUserIn(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)
    balance: str = "0"
    role: str = Field("player", pattern="^(player|admin)$")


class BalanceIn(BaseModel):
    amount: str
    note: Optional[str] = Field(None, max_length=200)


class UpdateUserIn(BaseModel):
    blocked: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)


@api.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin), q: str = ""):
    query = {"username": {"$regex": q.strip().lower(), "$options": "i"}} if q.strip() else {}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return [public_user(u) for u in users]


@api.post("/admin/users")
async def create_user(body: CreateUserIn, admin: dict = Depends(require_admin)):
    try:
        start = to_cents(body.balance or "0")
    except Exception:
        raise HTTPException(status_code=422, detail="Geçersiz bakiye")
    if start < 0:
        raise HTTPException(status_code=422, detail="Bakiye negatif olamaz")
    doc = {
        "id": str(uuid.uuid4()), "username": body.username.strip().lower(),
        "password_hash": hash_password(body.password), "role": body.role, "balance_cents": start,
        "blocked": False, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Bu kullanıcı adı zaten kullanılıyor")
    if start:
        await record_admin_tx(doc, "admin_credit", start, start, "Açılış bakiyesi", admin)
    return public_user(doc)


async def record_admin_tx(user, action, amount, balance_after, note, admin):
    await db.transactions.insert_one({
        "tx_id": f"adm-{uuid.uuid4()}", "user_id": user["id"], "username": user["username"],
        "action": action, "amount_cents": amount, "status": "ok", "rolled_back": False,
        "balance_after_cents": balance_after, "note": note, "by": admin["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@api.post("/admin/users/{user_id}/balance")
async def adjust_balance(user_id: str, body: BalanceIn, admin: dict = Depends(require_admin)):
    try:
        amount = to_cents(body.amount)
    except Exception:
        raise HTTPException(status_code=422, detail="Geçersiz tutar")
    if amount == 0:
        raise HTTPException(status_code=422, detail="Tutar sıfır olamaz")
    query = {"id": user_id}
    if amount < 0:
        query["balance_cents"] = {"$gte": -amount}
    updated = await db.users.find_one_and_update(query, {"$inc": {"balance_cents": amount}},
                                                 return_document=ReturnDocument.AFTER)
    if not updated:
        exists = await db.users.find_one({"id": user_id}, {"_id": 1})
        raise HTTPException(status_code=404 if not exists else 409,
                            detail="Oyuncu bulunamadı" if not exists else "Yetersiz bakiye")
    action = "admin_credit" if amount > 0 else "admin_debit"
    await record_admin_tx(updated, action, abs(amount), updated["balance_cents"], body.note, admin)
    return public_user(updated)


@api.patch("/admin/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserIn, admin: dict = Depends(require_admin)):
    changes = {}
    if body.blocked is not None:
        if user_id == admin["id"] and body.blocked:
            raise HTTPException(status_code=409, detail="Kendi hesabınızı kilitleyemezsiniz")
        changes["blocked"] = body.blocked
    if body.password:
        changes["password_hash"] = hash_password(body.password)
        changes["password_changed"] = True
    if not changes:
        raise HTTPException(status_code=422, detail="Değişiklik yok")
    updated = await db.users.find_one_and_update({"id": user_id}, {"$set": changes},
                                                 return_document=ReturnDocument.AFTER)
    if not updated:
        raise HTTPException(status_code=404, detail="Oyuncu bulunamadı")
    return public_user(updated)


@api.get("/admin/transactions")
async def list_transactions(admin: dict = Depends(require_admin), username: str = "",
                            action: str = "", limit: int = Query(100, ge=1, le=500)):
    query = {}
    if username.strip():
        query["username"] = username.strip().lower()
    if action:
        query["action"] = action
    txs = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [public_tx(t) for t in txs]


# ---------- Admin: Viper ----------
class CallbackSetupIn(BaseModel):
    callback_url: str = Field(pattern=r"^https://")


@api.get("/admin/viper/account")
async def viper_account(admin: dict = Depends(require_admin)):
    return await viper("GET", "/api/v1/account")


@api.get("/admin/viper/stats")
async def viper_stats(admin: dict = Depends(require_admin)):
    return await viper("GET", "/api/v1/manage/stats")


@api.get("/admin/viper/ggr")
async def viper_ggr(admin: dict = Depends(require_admin), date_from: str = "", date_to: str = ""):
    return await viper("GET", "/api/v1/manage/ggr", params={"from": date_from, "to": date_to})


@api.put("/admin/viper/callback")
async def viper_set_callback(body: CallbackSetupIn, admin: dict = Depends(require_admin)):
    return await viper("PUT", "/api/v1/manage/settings", {"callback_url": body.callback_url})


class SettingsIn(BaseModel):
    site_name: Optional[str] = Field(None, max_length=40)
    viper_api_url: Optional[str] = Field(None, max_length=200)
    viper_api_key: Optional[str] = Field(None, max_length=200)
    viper_api_secret: Optional[str] = Field(None, max_length=200)


@api.get("/public/settings")
async def public_settings():
    return {"site_name": await site_name()}


@api.get("/admin/settings")
async def admin_settings(admin: dict = Depends(require_admin)):
    base, key, secret = await viper_creds()
    return {"site_name": await site_name(), "viper_api_url": base,
            "viper_api_key_masked": mask(key) if key else "", "has_secret": bool(secret)}


@api.put("/admin/settings")
async def save_settings(body: SettingsIn, admin: dict = Depends(require_admin)):
    changes = {k: v.strip() for k, v in body.model_dump().items() if v and v.strip()}
    if "viper_api_url" in changes and not changes["viper_api_url"].startswith("https://"):
        raise HTTPException(status_code=422, detail="API adresi https:// ile başlamalı")
    for k in ("viper_api_key", "viper_api_secret"):
        if k in changes and (" " in changes[k] or not changes[k].isascii()):
            raise HTTPException(status_code=422, detail="Anahtar boşluk veya Türkçe karakter içeremez")
    if not changes:
        raise HTTPException(status_code=422, detail="Değişiklik yok")
    await update_settings(changes)
    return await admin_settings(admin)


@api.post("/admin/viper/integration-test")
async def viper_integration_test(admin: dict = Depends(require_admin)):
    return await viper("POST", "/api/v1/integration-test", {"player_id": admin["id"], "currency": "TRY"})


app.include_router(api)
app.include_router(wallet_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_admin()


@app.on_event("shutdown")
async def shutdown():
    client.close()
