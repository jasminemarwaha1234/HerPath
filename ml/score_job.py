"""
score_job.py
Score a single job listing against a user profile.

Returns a float in [0, 1]; higher is better.

Weights:
  title match  0.38  — how well the job title aligns with the user's current role
  wage equity  0.34  — lower women/men pay gap scores higher
  distance     0.23  — closer zip code scores higher (neutral 0.5 when zip missing)
  recency      0.05  — more recently posted scores higher (neutral 0.5 when missing)

Cross-domain penalty: if the user's field and the job's field are different domains
(e.g. engineer vs. marketing director), the raw score is multiplied by 0.12 so
wrong-field jobs are buried at the bottom of results.

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

# Cross-domain multiplier applied when user field != job field.
_CROSS_DOMAIN_PENALTY = 0.12

# Ordered list of (domain_name, pattern). First match wins.
_DOMAINS: list[tuple[str, re.Pattern]] = [
    ("tech",       re.compile(
        r'\b(engineer|engineering|developer|software|data|machine learning|ml|ai|'
        r'devops|sre|platform|backend|frontend|fullstack|full.?stack|infrastructure|'
        r'security|cloud|architect|programmer|sde|swe|qa|tester|analytics|'
        r'data scientist|research scientist|computer|cyber|network|systems)\b', re.I)),
    ("product",    re.compile(
        r'\b(product manager|product owner|program manager|project manager|'
        r'scrum master|agile|technical program)\b', re.I)),
    ("design",     re.compile(
        r'\b(design|designer|ux|ui|user experience|user interface|visual|'
        r'graphic|creative director|art director|motion)\b', re.I)),
    ("marketing",  re.compile(
        r'\b(marketing|brand|content|seo|sem|growth hacker|campaign|'
        r'social media|communications|copywriter|media buyer|demand gen)\b', re.I)),
    ("sales",      re.compile(
        r'\b(sales|account executive|account manager|business development|'
        r'revenue|customer success|solutions engineer|pre.?sales|inside sales)\b', re.I)),
    ("finance",    re.compile(
        r'\b(finance|financial|accounting|accountant|investment|banking|'
        r'audit|treasury|controller|cfo|actuar|equity|portfolio|trader|quant)\b', re.I)),
    ("hr",         re.compile(
        r'\b(human resources|hr |recruiter|recruiting|talent acquisition|'
        r'people ops|diversity|dei|workforce|compensation|benefits)\b', re.I)),
    ("legal",      re.compile(
        r'\b(legal|lawyer|attorney|counsel|paralegal|compliance|regulatory|'
        r'policy|contracts|litigation)\b', re.I)),
    ("ops",        re.compile(
        r'\b(operations|logistics|supply chain|procurement|facilities|'
        r'office manager|coordinator|administrator|chief of staff)\b', re.I)),
    ("healthcare", re.compile(
        r'\b(nurse|physician|doctor|clinical|medical|healthcare|pharmacy|'
        r'therapist|dentist|surgeon|radiolog|patholog)\b', re.I)),
    ("education",  re.compile(
        r'\b(teacher|professor|instructor|curriculum|academic|tutoring|'
        r'e.?learning|training|educator|teaching)\b', re.I)),
]


def _get_domain(text: str) -> str | None:
    for name, pat in _DOMAINS:
        if pat.search(text):
            return name
    return None


def _domain_multiplier(user_role: str, job_title: str) -> float:
    """Return 1.0 if domains match or are unknown; _CROSS_DOMAIN_PENALTY otherwise."""
    user_domain = _get_domain(user_role)
    job_domain  = _get_domain(job_title)
    if user_domain and job_domain and user_domain != job_domain:
        return _CROSS_DOMAIN_PENALTY
    return 1.0


def _title_score(user_role: str, job_title: str) -> float:
    """Jaccard similarity on lowercased word tokens, excluding common stop words."""
    _STOP = {"and", "or", "of", "the", "a", "an", "in", "at", "for", "to", "with"}

    def tokens(s: str) -> set:
        return set(re.findall(r"\w+", s.lower())) - _STOP

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
    user_role = user_info.get("current_role", "")
    job_title = job_info.get("title", "")

    title    = _title_score(user_role, job_title)
    equity   = _equity_score(job_info.get("womenAvg"), job_info.get("menAvg"))
    dist     = _distance_score(user_info.get("zipcode"), job_info.get("zipcode"))
    recency  = _recency_score(job_info.get("posted"))
    penalty  = _domain_multiplier(user_role, job_title)

    raw = _W_TITLE * title + _W_EQUITY * equity + _W_DISTANCE * dist + _W_RECENCY * recency
    return round(penalty * raw, 4)
