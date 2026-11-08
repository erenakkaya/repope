import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from db import db
from money import to_cents, fmt
from viper_client import verify_callback

wallet_router = APIRouter(prefix="/api")
log = logging.getLogger("wallet")


def ok(cents: int):
    return {"status": "OK", "balance": fmt(cents)}


def err(code: str):
    return {"status": "ERROR", "code": code}


async def balance_of(uid: str) -> int:
    user = await db.users.find_one({"id": uid}, {"balance_cents": 1})
    return user["balance_cents"]


async def set_tx(tx_id: str, fields: dict):
    await db.transactions.update_one({"tx_id": tx_id}, {"$set": fields})


async def insert_tx(p: dict, user: dict, action: str, amount: int) -> bool:
    doc = {
        "tx_id": p["tx_id"], "user_id": user["id"], "username": user["username"], "action": action,
        "amount_cents": amount, "status": "pending", "rolled_back": False,
        "ref_tx_id": p.get("ref_tx_id"), "round_id": p.get("round_id"), "game_id": p.get("game_id"),
        "provider": p.get("provider"), "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.transactions.insert_one(doc)
        return True
    except DuplicateKeyError:
        return False


async def replay(p: dict, uid: str):
    existing = await db.transactions.find_one({"tx_id": p["tx_id"]})
    if existing.get("status") == "rejected":
        return err(existing.get("error_code", "INSUFFICIENT_FUNDS"))
    return ok(await balance_of(uid))


async def handle_bet(p, user):
    amount = to_cents(p["amount"])
    if not await insert_tx(p, user, "bet", amount):
        return await replay(p, user["id"])
    if user.get("blocked"):
        await set_tx(p["tx_id"], {"status": "rejected", "error_code": "PLAYER_BLOCKED"})
        return err("PLAYER_BLOCKED")
    updated = await db.users.find_one_and_update(
        {"id": user["id"], "balance_cents": {"$gte": amount}},
        {"$inc": {"balance_cents": -amount}}, return_document=ReturnDocument.AFTER,
    )
    if not updated:
        await set_tx(p["tx_id"], {"status": "rejected", "error_code": "INSUFFICIENT_FUNDS"})
        return err("INSUFFICIENT_FUNDS")
    await set_tx(p["tx_id"], {"status": "ok", "balance_after_cents": updated["balance_cents"]})
    return ok(updated["balance_cents"])


async def handle_win(p, user):
    amount = to_cents(p["amount"])
    if not await insert_tx(p, user, "win", amount):
        return await replay(p, user["id"])
    updated = await db.users.find_one_and_update(
        {"id": user["id"]}, {"$inc": {"balance_cents": amount}}, return_document=ReturnDocument.AFTER
    )
    await set_tx(p["tx_id"], {"status": "ok", "balance_after_cents": updated["balance_cents"]})
    return ok(updated["balance_cents"])


async def handle_rollback(p, user):
    if not await insert_tx(p, user, "rollback", to_cents(p.get("amount") or 0)):
        return await replay(p, user["id"])
    ref = await db.transactions.find_one_and_update(
        {"tx_id": p.get("ref_tx_id"), "user_id": user["id"], "status": "ok", "rolled_back": False,
         "action": {"$in": ["bet", "win"]}},
        {"$set": {"rolled_back": True}},
    )
    delta = 0
    if ref:
        delta = ref["amount_cents"] if ref["action"] == "bet" else -ref["amount_cents"]
    updated = await db.users.find_one_and_update(
        {"id": user["id"]}, {"$inc": {"balance_cents": delta}}, return_document=ReturnDocument.AFTER
    )
    await set_tx(p["tx_id"], {"status": "ok", "amount_cents": abs(delta), "balance_after_cents": updated["balance_cents"]})
    return ok(updated["balance_cents"])


@wallet_router.post("/viper/callback")
async def viper_callback(request: Request):
    raw = await request.body()
    if not await verify_callback(request.headers.get("x-viper-timestamp", ""), request.headers.get("x-viper-signature", ""), raw):
        return err("INVALID_SIGNATURE")
    try:
        p = json.loads(raw)
    except ValueError:
        return err("BAD_REQUEST")
    user = await db.users.find_one({"id": p.get("player_id")}, {"_id": 0, "password_hash": 0})
    if not user:
        return err("PLAYER_NOT_FOUND")
    if p.get("currency") != "TRY":
        return err("CURRENCY_MISMATCH")
    action = p.get("action")
    if action == "balance":
        return ok(user["balance_cents"])
    handlers = {"bet": handle_bet, "win": handle_win, "rollback": handle_rollback}
    if action not in handlers or not p.get("tx_id"):
        return err("BAD_REQUEST")
    try:
        return await handlers[action](p, user)
    except Exception:
        log.exception("callback failed")
        return err("INTERNAL_ERROR")
