"""
Resolve a user-entered ZIP code or city string to structured location data.
Uses Zippopotam.us for ZIPs — no API key needed.
"""
from __future__ import annotations
import re
import httpx


async def resolve_location(q: str) -> dict | None:
    """
    Accepts a 5-digit ZIP or a string like "San Francisco, CA" / "Austin TX".
    Returns { city, state, lat, lng } or None if unresolvable.
    """
    q = q.strip()
    if re.fullmatch(r"\d{5}", q):
        return await _resolve_zip(q)
    return _parse_city_string(q)


async def _resolve_zip(zip_code: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"https://api.zippopotam.us/us/{zip_code}")
        if r.status_code != 200:
            return None
        data = r.json()
        place = data["places"][0]
        return {
            "city":  place["place name"],
            "state": place["state abbreviation"],
            "lat":   float(place["latitude"]),
            "lng":   float(place["longitude"]),
        }
    except Exception:
        return None


def _parse_city_string(s: str) -> dict | None:
    # Match "City, ST" or "City ST" where ST is a 2-letter abbreviation
    m = re.match(r"^(.+?)[,\s]+([A-Za-z]{2})$", s.strip())
    if m:
        return {
            "city":  m.group(1).strip().title(),
            "state": m.group(2).upper(),
            "lat":   None,
            "lng":   None,
        }
    # City name only — no state
    return {
        "city":  s.title(),
        "state": None,
        "lat":   None,
        "lng":   None,
    }
