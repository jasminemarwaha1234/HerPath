"""
Role → BLS data mapping for the 15 supported roles.

national_median: BLS OEWS 2023 annual wage (all workers)
gender_ratio: women's median earnings as a fraction of men's
              Source: BLS Highlights of Women's Earnings 2023
"""
from __future__ import annotations

ROLES = {
    "software engineer": {
        "display": "Software Engineer",
        "soc": "15-1252",
        "national_median": 130160,
        "gender_ratio": 0.83,
    },
    "data scientist": {
        "display": "Data Scientist",
        "soc": "15-2051",
        "national_median": 108020,
        "gender_ratio": 0.87,
    },
    "financial analyst": {
        "display": "Financial Analyst",
        "soc": "13-2051",
        "national_median": 96220,
        "gender_ratio": 0.82,
    },
    "marketing manager": {
        "display": "Marketing Manager",
        "soc": "11-2021",
        "national_median": 156580,
        "gender_ratio": 0.78,
    },
    "lawyer": {
        "display": "Lawyer",
        "soc": "23-1011",
        "national_median": 145760,
        "gender_ratio": 0.77,
    },
    "registered nurse": {
        "display": "Registered Nurse",
        "soc": "29-1141",
        "national_median": 86070,
        "gender_ratio": 0.88,
    },
    "accountant": {
        "display": "Accountant",
        "soc": "13-2011",
        "national_median": 79880,
        "gender_ratio": 0.81,
    },
    "hr manager": {
        "display": "HR Manager",
        "soc": "11-3121",
        "national_median": 136380,
        "gender_ratio": 0.85,
    },
    "project manager": {
        "display": "Project Manager",
        "soc": "13-1082",
        "national_median": 98580,
        "gender_ratio": 0.84,
    },
    "product manager": {
        "display": "Product Manager",
        "soc": "11-2021",
        "national_median": 156580,
        "gender_ratio": 0.85,
    },
    "ux designer": {
        "display": "UX Designer",
        "soc": "15-1255",
        "national_median": 98860,
        "gender_ratio": 0.86,
    },
    "systems analyst": {
        "display": "Systems Analyst",
        "soc": "15-1211",
        "national_median": 102240,
        "gender_ratio": 0.84,
    },
    "management consultant": {
        "display": "Management Consultant",
        "soc": "13-1111",
        "national_median": 99410,
        "gender_ratio": 0.81,
    },
    "it manager": {
        "display": "IT Manager",
        "soc": "11-3021",
        "national_median": 169510,
        "gender_ratio": 0.84,
    },
    "teacher": {
        "display": "Teacher",
        "soc": "25-2021",
        "national_median": 63680,
        "gender_ratio": 0.96,
    },
}

# Approximate local wage multipliers relative to national BLS median.
# Derived from BLS metro area OEWS wage differentials.
CITY_MULTIPLIERS = {
    "san francisco": 1.45,
    "new york":      1.42,
    "seattle":       1.28,
    "boston":        1.25,
    "washington":    1.22,
    "los angeles":   1.20,
    "chicago":       1.08,
    "austin":        1.05,
    "denver":        1.05,
    "portland":      1.10,
    "miami":         1.02,
    "atlanta":       0.98,
    "dallas":        0.97,
    "phoenix":       0.95,
}


def resolve_role(query: str) -> dict | None:
    q = query.lower().strip()
    if q in ROLES:
        return ROLES[q]
    for key, data in ROLES.items():
        if key in q or q in key:
            return data
    return None


def city_multiplier(city: str) -> float:
    city_lower = city.lower()
    for known, mult in CITY_MULTIPLIERS.items():
        if known in city_lower:
            return mult
    return 1.0
