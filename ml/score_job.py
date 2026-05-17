"""
score_job.py
Score a single job listing against a user profile.

Returns a float in [0, 1]; higher is better.

Weights:
  title match  0.38  — how well the job title aligns with the user's current role
  wage equity  0.34  — lower women/men pay gap scores higher
  distance     0.23  — closer zip code scores higher (neutral 0.5 when zip missing)
  recency      0.05  — more recently posted scores higher (neutral 0.5 when missing)

Usage:
    from score_job import score_job

    score = score_job(
        job_info  = {"title": "Data Scientist", "womenAvg": 95000, "menAvg": 115000, "zipcode": "94025", "posted": "2 days ago"},
        user_info = {"current_role": "Data Analyst", "zipcode": "94105"},
    )
"""

from __future__ import annotations

import math
import re
from typing import Any

_W_TITLE    = 0.38
_W_EQUITY   = 0.34
_W_DISTANCE = 0.23
_W_RECENCY  = 0.05


def _title_score(user_role: str, job_title: str) -> float:
    """Jaccard similarity on lowercased word tokens."""
    def tokens(s: str) -> set:
        return set(re.findall(r"\w+", s.lower()))

    a, b = tokens(user_role), tokens(job_title)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _equity_score(women_avg: float | None, men_avg: float | None) -> float:
    """women_avg / men_avg clamped to [0, 1]. Higher ratio = smaller gap = better score."""
    if not women_avg or not men_avg or men_avg == 0:
        return 0.5
    return float(min(women_avg / men_avg, 1.0))


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _distance_score(user_zip: str | None, job_zip: str | None) -> float:
    """Exponential decay over km distance. Returns 0.5 when either zip is absent."""
    if not user_zip or not job_zip:
        return 0.5
    try:
        import pgeocode
        nomi = pgeocode.Nominatim("us")
        u = nomi.query_postal_code(str(user_zip))
        j = nomi.query_postal_code(str(job_zip))
        coords = [u.latitude, u.longitude, j.latitude, j.longitude]
        if any(math.isnan(float(v)) for v in coords):
            return 0.5
        dist_km = _haversine(float(u.latitude), float(u.longitude),
                             float(j.latitude),  float(j.longitude))
        # 1.0 at 0 km → ~0.51 at 100 km → ~0.19 at 250 km → ~0.04 at 500 km
        return float(math.exp(-dist_km / 150))
    except Exception:
        return 0.5


def _recency_score(posted: str | None) -> float:
    """Exponential decay over days since posting. Returns 0.5 when missing."""
    if not posted:
        return 0.5
    s = posted.lower().strip()
    if s == "today" or s == "just now":
        days = 0
    else:
        day_m  = re.search(r"(\d+)\s+day",  s)
        week_m = re.search(r"(\d+)\s+week", s)
        mon_m  = re.search(r"(\d+)\s+month", s)
        if day_m:
            days = int(day_m.group(1))
        elif week_m:
            days = int(week_m.group(1)) * 7
        elif mon_m:
            days = int(mon_m.group(1)) * 30
        else:
            return 0.5
    # 1.0 today → ~0.78 at 7 days → ~0.37 at 28 days
    return float(math.exp(-days / 30))


def score_job(job_info: dict[str, Any], user_info: dict[str, Any]) -> float:
    """
    Score one job against a user profile. Returns float in [0, 1].

    job_info  — expects: title, womenAvg, menAvg, zipcode, posted
    user_info — expects: current_role, zipcode
    """
    title    = _title_score(user_info.get("current_role", ""), job_info.get("title", ""))
    equity   = _equity_score(job_info.get("womenAvg"), job_info.get("menAvg"))
    dist     = _distance_score(user_info.get("zipcode"), job_info.get("zipcode"))
    recency  = _recency_score(job_info.get("posted"))

    return round(_W_TITLE * title + _W_EQUITY * equity + _W_DISTANCE * dist + _W_RECENCY * recency, 4)
