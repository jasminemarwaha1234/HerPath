"""
Fetch individual job listings from Adzuna and JSearch.
Each listing includes title, company, salary, level, work type, posted date, etc.
"""
import os
import re
from datetime import datetime, timezone
import httpx

ADZUNA_APP_ID  = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
JSEARCH_KEY    = os.getenv("JSEARCH_KEY")

_CONTRACT_LABELS = {
    "permanent": "Full-time",
    "full_time":  "Full-time",
    "part_time":  "Part-time",
    "contract":   "Contract",
    "temporary":  "Contract",
}


def _posted_ago(iso_str: str) -> str | None:
    try:
        dt   = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - dt).days
        if days == 0: return "today"
        if days == 1: return "1 day ago"
        if days < 7:  return f"{days} days ago"
        weeks = days // 7
        return f"{weeks} week{'s' if weeks > 1 else ''} ago"
    except Exception:
        return None


def _parse_level(title: str) -> str | None:
    t = title.lower()
    if re.search(r'\b(principal|distinguished|fellow|vp|director)\b', t):
        return "Principal"
    if re.search(r'\bstaff\b', t):
        return "Staff"
    if re.search(r'\b(senior|sr|lead|iii|iv)\b', t):
        return "Senior"
    if re.search(r'\b(ii|mid.?level)\b', t):
        return "Mid-level"
    if re.search(r'\b(junior|jr|associate|entry)\b', t) or re.search(r'\bi\b', t):
        return "Junior"
    return None


def _parse_work_type(title: str, location: str | None, is_remote: bool | None = None) -> str | None:
    if is_remote:
        return "Remote"
    text = f"{title} {location or ''}".lower()
    if "remote" in text:
        return "Remote"
    if "hybrid" in text:
        return "Hybrid"
    return "On-site"


async def get_listings(role: str, city: str, state: str | None) -> list[dict]:
    location = f"{city} {state}" if state else city
    listings = []

    if ADZUNA_APP_ID and ADZUNA_APP_KEY:
        listings.extend(await _fetch_adzuna(role, location))

    if JSEARCH_KEY and len(listings) < 5:
        listings.extend(await _fetch_jsearch(role, location))

    return listings


async def _fetch_adzuna(role: str, location: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://api.adzuna.com/v1/api/jobs/us/search/1",
                params={
                    "app_id":           ADZUNA_APP_ID,
                    "app_key":          ADZUNA_APP_KEY,
                    "what":             role,
                    "where":            location,
                    "results_per_page": 20,
                    "content-type":     "application/json",
                },
            )
        if r.status_code != 200:
            return []

        out = []
        for j in r.json().get("results", []):
            sal_min  = j.get("salary_min")
            sal_max  = j.get("salary_max")
            sal_mid  = round((sal_min + sal_max) / 2) if sal_min and sal_max else None
            contract = (j.get("contract_type") or j.get("contract_time") or "").lower()
            title    = j.get("title") or ""
            loc      = (j.get("location") or {}).get("display_name")

            out.append({
                "source":        "adzuna",
                "title":         title,
                "company":       (j.get("company") or {}).get("display_name"),
                "location":      loc,
                "work_type":     _parse_work_type(title, loc),
                "level":         _parse_level(title),
                "posted_at":     _posted_ago(j["created"]) if j.get("created") else None,
                "contract_type": _CONTRACT_LABELS.get(contract),
                "category":      (j.get("category") or {}).get("label"),
                "salary_min":    round(sal_min) if sal_min else None,
                "salary_max":    round(sal_max) if sal_max else None,
                "salary_mid":    sal_mid,
                "url":           j.get("redirect_url"),
            })
        return out

    except Exception:
        return []


async def _fetch_jsearch(role: str, location: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://jsearch.p.rapidapi.com/search",
                params={
                    "query":     f"{role} in {location}",
                    "num_pages": "1",
                },
                headers={
                    "X-RapidAPI-Key":  JSEARCH_KEY,
                    "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                },
            )
        if r.status_code != 200:
            return []

        out = []
        for j in r.json().get("data", []):
            sal_min  = j.get("job_min_salary")
            sal_max  = j.get("job_max_salary")
            sal_mid  = round((sal_min + sal_max) / 2) if sal_min and sal_max else None
            emp_type = (j.get("job_employment_type") or "").upper()
            contract = {"FULLTIME": "Full-time", "PARTTIME": "Part-time",
                        "CONTRACTOR": "Contract"}.get(emp_type)
            city_str  = j.get("job_city",  "")
            state_str = j.get("job_state", "")
            loc       = f"{city_str}, {state_str}".strip(", ") or None
            title     = j.get("job_title") or ""

            out.append({
                "source":        "jsearch",
                "title":         title,
                "company":       j.get("employer_name"),
                "location":      loc,
                "work_type":     _parse_work_type(title, loc, j.get("job_is_remote")),
                "level":         _parse_level(title),
                "posted_at":     _posted_ago(j["job_posted_at_datetime_utc"])
                                 if j.get("job_posted_at_datetime_utc") else None,
                "contract_type": contract,
                "category":      None,
                "salary_min":    round(sal_min) if sal_min else None,
                "salary_max":    round(sal_max) if sal_max else None,
                "salary_mid":    sal_mid,
                "url":           j.get("job_apply_link"),
            })
        return out

    except Exception:
        return []
