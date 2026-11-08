import os

from db import db

DEFAULT_SITE_NAME = "VIPERGGR"


async def get_settings() -> dict:
    doc = await db.settings.find_one({"key": "site"}, {"_id": 0}) or {}
    return doc


async def site_name() -> str:
    return (await get_settings()).get("site_name") or DEFAULT_SITE_NAME


async def viper_creds() -> tuple[str, str, str]:
    s = await get_settings()
    return (
        s.get("viper_api_url") or os.environ.get("VIPER_API_URL", ""),
        s.get("viper_api_key") or os.environ.get("VIPER_API_KEY", ""),
        s.get("viper_api_secret") or os.environ.get("VIPER_API_SECRET", ""),
    )


async def update_settings(changes: dict):
    await db.settings.update_one({"key": "site"}, {"$set": changes}, upsert=True)


def mask(value: str) -> str:
    return f"{value[:6]}…{value[-4:]}" if len(value) > 12 else ("•" * len(value))
