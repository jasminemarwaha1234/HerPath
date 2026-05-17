from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import math
import re

load_dotenv(Path(__file__).parent.parent / ".env")

from .jobs import get_listings
from .gap import compute_gap
from .location import resolve_location
from . import cache


def _haversine_mi(lat1, lon1, lat2, lon2) -> float:
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

app = FastAPI(title="HerPath Jobs API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/jobs")
async def jobs(
    role: str = Query(...),
    zipcode: str = Query(""),
):
    cache_key = f"jobs:{role}:{zipcode}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    loc   = await resolve_location(zipcode) if zipcode else None
    city  = loc["city"]  if loc else "United States"
    state = loc["state"] if loc else None

    listings = await get_listings(role, city, state)
    gap      = compute_gap(role, city)

    if loc:
        city_lower  = city.lower()
        state_upper = (state or "").upper()
        def location_matches(loc_str):
            if not loc_str:
                return False
            s = loc_str.lower()
            # city substring match (e.g. "san francisco" in "san francisco, ca")
            if city_lower in s:
                return True
            # state abbreviation: only match as whole word/token (e.g. ", CA" not "catering")
            if state_upper and re.search(r'(?<![a-z])' + re.escape(state_upper.lower()) + r'(?![a-z])', s):
                return True
            return False
        listings = [j for j in listings if location_matches(j.get("location"))]

    listings.sort(key=lambda j: j.get("days_old", 9999))

    gap_ratio = (gap["gap_ratio"] / 100) if gap else 0.82

    user_lat = loc["lat"] if loc else None
    user_lng = loc["lng"] if loc else None

    result = []
    for i, j in enumerate(listings):
        sal_mid = j.get("salary_mid")
        if sal_mid:
            men_avg   = sal_mid
            women_avg = round(sal_mid * gap_ratio)
            women_pct = round(gap_ratio * 100)
        elif gap:
            men_avg   = gap["mens_market_rate"]
            women_avg = gap["womens_expected"]
            women_pct = gap["gap_ratio"]
        else:
            men_avg = women_avg = women_pct = None

        job_lat = j.get("lat")
        job_lng = j.get("lng")
        if user_lat and user_lng and job_lat and job_lng:
            dist_mi = _haversine_mi(user_lat, user_lng, job_lat, job_lng)
            distance_str = f"{dist_mi:.1f} mi away"
        else:
            distance_str = None

        result.append({
            "id":          i + 1,
            "title":       j["title"],
            "company":     j["company"] or "—",
            "companyType": j.get("category") or "Company",
            "location":    j["location"] or city,
            "workType":    j["work_type"] or "On-site",
            "distance":    distance_str,
            "match":       0,
            "posted":      j["posted_at"] or "—",
            "womenAvg":    women_avg,
            "menAvg":      men_avg,
            "womenPct":    women_pct,
            "url":         j.get("url"),
            "zipcode":     None,
        })

    cache.set(cache_key, result)
    return result
