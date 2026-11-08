import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from settings_store import viper_creds


async def _creds():
    base, key, secret = await viper_creds()
    if not (base and key and secret):
        raise HTTPException(status_code=503, detail="Viper API anahtarları henüz ayarlanmadı")
    return base.rstrip("/"), key, secret


async def viper(method: str, path: str, body: dict | None = None, params: dict | None = None):
    base, key, secret = await _creds()
    params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
    path_q = path + (f"?{urlencode(params)}" if params else "")
    raw = json.dumps(body, separators=(",", ":")).encode() if body is not None else b""
    ts = str(int(time.time()))
    to_sign = f"{ts}\n{method}\n{path_q}\n{hashlib.sha256(raw).hexdigest()}"
    sig = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).hexdigest()
    headers = {"X-Api-Key": key, "X-Timestamp": ts, "X-Signature": sig, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.request(method, base + path_q, content=raw or None, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=424, detail=f"Viper sunucusuna ulaşılamadı: {exc}")
    try:
        data = res.json()
    except ValueError:
        data = {}
    if res.status_code >= 400:
        err = data.get("error") if isinstance(data, dict) else None
        err = err if isinstance(err, dict) else {}
        msg = err.get("message") or res.text[:200]
        raise HTTPException(status_code=424, detail=f"Viper hatası ({res.status_code} {err.get('code', '')}): {msg}")
    return data


async def verify_callback(timestamp: str, signature: str, raw: bytes) -> bool:
    secret = (await viper_creds())[2]
    if not secret or not timestamp or not signature:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.lower())
