from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import math
import re
import os
import httpx

load_dotenv(Path(__file__).parent.parent / ".env")

from .jobs import get_listings
from .gap import compute_gap
from .location import resolve_location
from . import cache

PROMPT_PATH = Path(__file__).parent.parent / "agent_prompt.md"
_prompt_template: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _prompt_template
    _prompt_template = PROMPT_PATH.read_text(encoding="utf-8")
    yield


def _haversine_mi(lat1, lon1, lat2, lon2) -> float:
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

app = FastAPI(title="HerPath Jobs API", lifespan=lifespan)

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


class ChatRequest(BaseModel):
    messages: list
    user_profile: dict = {}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    profile = req.user_profile
    defaults = {
        "name": "Unknown", "age": "N/A", "gender": "N/A",
        "field": "N/A", "role": "N/A", "job_level": "N/A",
        "gpa": "N/A", "internships": "N/A", "networking_score": "N/A",
        "starting_salary": "N/A", "pay_gap": "N/A",
        "promotion_probability": "N/A", "marital_status": "N/A",
        "maternity_leave_taken": "N/A", "maternity_leave_planned": "N/A",
    }
    filled = {k: profile.get(k, v) for k, v in defaults.items()}
    system_prompt = _prompt_template.format(**filled)

    payload = {
        "model": "grok-3-mini",
        "messages": [{"role": "system", "content": system_prompt}, *req.messages],
    }

    api_key = os.environ.get("GROQ_API_KEY", "")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.x.ai/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Upstream connection error: {e}")

    data = resp.json()
    return {"reply": data["choices"][0]["message"]["content"]}
