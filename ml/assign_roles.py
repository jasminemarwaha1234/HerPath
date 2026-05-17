import re
from pathlib import Path

FROM_VALUES_PATH = Path(__file__).parent.parent / 'from_values.txt'


def load_from_roles() -> list[str]:
    """Read unique 'from' roles from from_values.txt."""
    text = FROM_VALUES_PATH.read_text()
    return re.findall(r"'([^']+)'", text)


JOB_TITLES = load_from_roles()

# ── Role assignment ───────────────────────────────────────────────────────────

_EXECUTIVE_KEYWORDS = re.compile(
    r'\b(chief|vice president|vp|director|head of|cto|cio|ceo|executive|'
    r'principal|partner|practice director|engineering senior director|'
    r'software development vice president|engineering vice president)\b',
    re.IGNORECASE,
)

_SENIOR_KEYWORDS = re.compile(
    r'\b(senior|lead|staff|architect|manager|supervisor|'
    r'team lead|technical lead|module lead|module leader|'
    r'technical leader|sr\.?)\b',
    re.IGNORECASE,
)

_ENTRY_KEYWORDS = re.compile(
    r'\b(intern|trainee|junior|jr\.?|assistant|student|graduate|'
    r'associate|beginner|apprentice|entry)\b',
    re.IGNORECASE,
)


def assign_role(title: str) -> str:
    """
    Map a job title to one of four seniority tiers:
      'executive', 'senior', 'mid', 'entry'
    """
    if _EXECUTIVE_KEYWORDS.search(title):
        return 'executive'
    if _SENIOR_KEYWORDS.search(title):
        return 'senior'
    if _ENTRY_KEYWORDS.search(title):
        return 'entry'
    return 'mid'


def get_role_mapping() -> dict[str, str]:
    """Return {job_title: role} for all from roles."""
    return {title: assign_role(title) for title in JOB_TITLES}


if __name__ == '__main__':
    mapping = get_role_mapping()
    from collections import Counter
    counts = Counter(mapping.values())
    print(f"Total titles : {len(mapping)}")
    print(f"executive    : {counts['executive']}")
    print(f"senior       : {counts['senior']}")
    print(f"mid          : {counts['mid']}")
    print(f"entry        : {counts['entry']}")
