import asyncio
import logging
import os
from contextlib import suppress
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

from db import db, client
from auth import (verify_password, create_token, current_user, require_admin,
                  check_lock, register_failure, clear_failures, seed_admin)
from viper_client import viper
from settings_store import site_name, viper_creds, update_settings, mask
from wallet import wallet_router
from manage import manage_router, public_user, public_tx

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
    if user["role"] == "dealer":
        raise HTTPException(status_code=403, detail="Bayi hesabıyla oyun oynanamaz")
    payload = {"player_id": user["id"], "currency": "TRY", "game_id": body.game_id, "lang": "tr", "country": "TR"}
    if body.return_url and body.return_url.startswith(("http://", "https://")):
        payload["return_url"] = body.return_url
    return await viper("POST", "/api/v1/launch", payload)


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
app.include_router(manage_router)
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
