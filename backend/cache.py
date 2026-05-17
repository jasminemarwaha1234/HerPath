from datetime import datetime, timedelta

TTL_HOURS = 24

_store: dict[str, tuple] = {}


def get(key: str):
    entry = _store.get(key)
    if not entry:
        return None
    result, expires_at = entry
    if datetime.utcnow() > expires_at:
        del _store[key]
        return None
    return result


def set(key: str, value):
    _store[key] = (value, datetime.utcnow() + timedelta(hours=TTL_HOURS))


def clear():
    _store.clear()


def size() -> int:
    return len(_store)
