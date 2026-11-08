import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth import current_user, hash_password
from db import db
from money import to_cents, fmt

manage_router = APIRouter(prefix="/api/manage")
AFTER = ReturnDocument.AFTER
ACTIVE = {"deleted": {"$ne": True}}


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "role": u["role"],
        "balance": fmt(u.get("balance_cents", 0)), "blocked": u.get("blocked", False),
        "parent_id": u.get("parent_id"), "parent_username": u.get("parent_username"),
        "created_at": u.get("created_at"),
    }


def public_tx(t: dict) -> dict:
    return {
        "tx_id": t["tx_id"], "username": t.get("username"), "action": t["action"],
        "amount": fmt(t.get("amount_cents", 0)), "status": t.get("status"),
        "error_code": t.get("error_code"), "rolled_back": t.get("rolled_back", False),
        "balance_after": fmt(t["balance_after_cents"]) if t.get("balance_after_cents") is not None else None,
        "game_id": t.get("game_id"), "provider": t.get("provider"), "round_id": t.get("round_id"),
        "note": t.get("note"), "by": t.get("by"), "created_at": t.get("created_at"),
    }


async def require_manager(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in ("admin", "dealer"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    return user


def scope(manager: dict) -> dict:
    return dict(ACTIVE) if manager["role"] == "admin" else {**ACTIVE, "parent_id": manager["id"]}


async def get_target(manager: dict, user_id: str) -> dict:
    target = await db.users.find_one({**scope(manager), "id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return target


async def record_tx(user, action, amount, balance_after, note, by):
    await db.transactions.insert_one({
        "tx_id": f"adm-{uuid.uuid4()}", "user_id": user["id"], "username": user["username"],
        "action": action, "amount_cents": amount, "status": "ok", "rolled_back": False,
        "balance_after_cents": balance_after, "note": note, "by": by["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def inc(user_id: str, delta: int, min_needed: int = 0):
    query = {"id": user_id}
    if min_needed:
        query["balance_cents"] = {"$gte": min_needed}
    return await db.users.find_one_and_update(query, {"$inc": {"balance_cents": delta}}, return_document=AFTER)


async def move(manager: dict, target: dict, amount: int, note: Optional[str]) -> dict:
    dealer = manager["role"] == "dealer"
    if amount > 0:
        if dealer:
            src = await inc(manager["id"], -amount, amount)
            if not src:
                raise HTTPException(status_code=409, detail="Bayi bakiyeniz yetersiz")
            await record_tx(src, "transfer_out", amount, src["balance_cents"], f"→ {target['username']}", manager)
        updated = await inc(target["id"], amount)
        await record_tx(updated, "admin_credit", amount, updated["balance_cents"], note, manager)
    else:
        updated = await inc(target["id"], amount, -amount)
        if not updated:
            raise HTTPException(status_code=409, detail="Kullanıcının bakiyesi yetersiz")
        await record_tx(updated, "admin_debit", -amount, updated["balance_cents"], note, manager)
        if dealer:
            back = await inc(manager["id"], -amount)
            await record_tx(back, "transfer_in", -amount, back["balance_cents"], f"← {target['username']}", manager)
    return updated


class CreateUserIn(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)
    balance: str = "0"
    role: str = Field("player", pattern="^(player|dealer|admin)$")


class BalanceIn(BaseModel):
    amount: str
    mode: str = Field("add", pattern="^(add|deduct|set)$")
    note: Optional[str] = Field(None, max_length=200)


class UpdateUserIn(BaseModel):
    blocked: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)


def parse_amount(value: str) -> int:
    try:
        cents = to_cents((value or "0").replace(",", "."))
    except Exception:
        raise HTTPException(status_code=422, detail="Geçersiz tutar")
    if cents < 0:
        raise HTTPException(status_code=422, detail="Tutar negatif olamaz")
    return cents


@manage_router.get("/users")
async def list_users(manager: dict = Depends(require_manager), q: str = "", role: str = ""):
    query = scope(manager)
    if q.strip():
        query["username"] = {"$regex": q.strip().lower(), "$options": "i"}
    if role and manager["role"] == "admin":
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return [public_user(u) for u in users]


@manage_router.post("/users")
async def create_user(body: CreateUserIn, manager: dict = Depends(require_manager)):
    start = parse_amount(body.balance)
    dealer = manager["role"] == "dealer"
    doc = {
        "id": str(uuid.uuid4()), "username": body.username.strip().lower(),
        "password_hash": hash_password(body.password), "role": "player" if dealer else body.role,
        "balance_cents": 0, "blocked": False, "deleted": False,
        "parent_id": manager["id"] if dealer else None,
        "parent_username": manager["username"] if dealer else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Bu kullanıcı adı zaten kullanılıyor")
    if start:
        try:
            doc = await move(manager, doc, start, "Açılış bakiyesi")
        except HTTPException:
            await db.users.update_one({"id": doc["id"]}, {"$set": {"deleted": True, "blocked": True, "username": f"{doc['username']}#iptal-{doc['id'][:6]}"}})
            raise
    return public_user(doc)


@manage_router.post("/users/{user_id}/balance")
async def adjust_balance(user_id: str, body: BalanceIn, manager: dict = Depends(require_manager)):
    target = await get_target(manager, user_id)
    if target["id"] == manager["id"]:
        raise HTTPException(status_code=409, detail="Kendi bakiyenizi değiştiremezsiniz")
    amount = parse_amount(body.amount)
    delta = {"add": amount, "deduct": -amount, "set": amount - target["balance_cents"]}[body.mode]
    if delta == 0:
        raise HTTPException(status_code=422, detail="Bakiye değişmiyor")
    return public_user(await move(manager, target, delta, body.note or ("Bakiye düzeltme" if body.mode == "set" else None)))


@manage_router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserIn, manager: dict = Depends(require_manager)):
    target = await get_target(manager, user_id)
    changes = {}
    if body.blocked is not None:
        if target["id"] == manager["id"]:
            raise HTTPException(status_code=409, detail="Kendi hesabınızı kilitleyemezsiniz")
        changes["blocked"] = body.blocked
    if body.password:
        changes["password_hash"] = hash_password(body.password)
        changes["password_changed"] = True
    if not changes:
        raise HTTPException(status_code=422, detail="Değişiklik yok")
    updated = await db.users.find_one_and_update({"id": target["id"]}, {"$set": changes}, return_document=AFTER)
    return public_user(updated)


@manage_router.delete("/users/{user_id}")
async def soft_delete_user(user_id: str, manager: dict = Depends(require_manager)):
    target = await get_target(manager, user_id)
    if target["id"] == manager["id"]:
        raise HTTPException(status_code=409, detail="Kendi hesabınızı silemezsiniz")
    if target["role"] == "dealer" and await db.users.count_documents({**ACTIVE, "parent_id": target["id"]}):
        raise HTTPException(status_code=409, detail="Önce bu bayinin oyuncularını silin")
    if target["balance_cents"] > 0:
        owner = manager
        if manager["role"] == "admin" and target.get("parent_id"):
            owner = await db.users.find_one({"id": target["parent_id"]}, {"_id": 0}) or manager
        await move(owner, target, -target["balance_cents"], "Hesap silindi, bakiye iade")
    await db.users.update_one({"id": target["id"]}, {"$set": {
        "deleted": True, "blocked": True, "original_username": target["username"],
        "username": f"{target['username']}#silindi-{target['id'][:6]}",
        "deleted_at": datetime.now(timezone.utc).isoformat(), "deleted_by": manager["username"],
    }})
    return {"ok": True}


@manage_router.get("/transactions")
async def list_transactions(manager: dict = Depends(require_manager), username: str = "",
                            action: str = "", limit: int = Query(100, ge=1, le=500)):
    query = {}
    if manager["role"] == "dealer":
        ids = await db.users.distinct("id", {"parent_id": manager["id"]})
        query["user_id"] = {"$in": ids + [manager["id"]]}
    if username.strip():
        query["username"] = username.strip().lower()
    if action:
        query["action"] = action
    txs = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [public_tx(t) for t in txs]
