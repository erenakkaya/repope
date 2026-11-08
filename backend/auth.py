import os
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

from db import db

JWT_ALG = "HS256"
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp}, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def current_user(request: Request) -> dict:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")
    try:
        payload = jwt.decode(header[7:], os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or user.get("blocked"):
        raise HTTPException(status_code=401, detail="Hesap erişilemez")
    return user


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    return user


async def check_lock(key: str):
    doc = await db.login_attempts.find_one({"key": key})
    if doc and doc.get("locked_until") and datetime.fromisoformat(doc["locked_until"]) > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.")


async def register_failure(key: str):
    doc = await db.login_attempts.find_one_and_update(
        {"key": key}, {"$inc": {"count": 1}}, upsert=True, return_document=True
    )
    if doc["count"] >= MAX_ATTEMPTS:
        until = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()
        await db.login_attempts.update_one({"key": key}, {"$set": {"locked_until": until, "count": 0}})


async def clear_failures(key: str):
    await db.login_attempts.update_one({"key": key}, {"$set": {"count": 0, "locked_until": None}})


async def seed_admin():
    username = os.environ["ADMIN_USERNAME"].strip().lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"username": username})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": username,
            "password_hash": hash_password(password),
            "role": "admin",
            "balance_cents": 0,
            "blocked": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not existing.get("password_changed") and not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"username": username}, {"$set": {"password_hash": hash_password(password), "role": "admin"}})
