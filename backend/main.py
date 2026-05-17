from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

from .jobs import get_listings
from .gap import compute_gap
from .location import resolve_location
from . import cache

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
        state_lower = (state or "").lower()
        def location_matches(loc_str):
            if not loc_str:
                return False
            s = loc_str.lower()
            return city_lower in s or (state_lower and state_lower in s)
        listings = [j for j in listings if location_matches(j.get("location"))]

    listings.sort(key=lambda j: j.get("days_old", 9999))

    gap_ratio = (gap["gap_ratio"] / 100) if gap else 0.82

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

        result.append({
            "id":          i + 1,
            "title":       j["title"],
            "company":     j["company"] or "—",
            "companyType": j.get("category") or "Company",
            "location":    j["location"] or city,
            "workType":    j["work_type"] or "On-site",
            "distance":    None,
            "match":       0,
            "posted":      j["posted_at"] or "—",
            "womenAvg":    women_avg,
            "menAvg":      men_avg,
            "womenPct":    women_pct,
            "url":         j.get("url"),
            "zipcode":     zipcode or None,
        })

    cache.set(cache_key, result)
    return result
