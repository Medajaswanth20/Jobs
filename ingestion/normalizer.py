"""
Normalizes raw job dicts from each source into a common schema.
"""
import re
from datetime import datetime, timezone
from dateutil import parser as dateutil_parser

# Expanded role categories
ROLE_RULES = [
    ("data-integrity",      ["data integrity", "data quality", "dq analyst", "data governance"]),
    ("data-engineer",       ["data engineer", "etl", "pipeline engineer", "data platform"]),
    ("analytics-engineer",  ["analytics engineer", "dbt", "analytics eng"]),
    ("business-analyst",    ["business analyst", "business intelligence", "bi analyst", "reporting analyst"]),
    ("data-scientist",      ["data scientist", "ml engineer", "machine learning", "mlops"]),
    ("data-analyst",        ["data analyst", "analyst"]),  # broad catch-all last
]


def categorize(title: str, jd: str) -> str:
    text = (title + " " + jd).lower()
    for category, keywords in ROLE_RULES:
        if any(kw in text for kw in keywords):
            return category
    return "other"


def tag_job(title: str, jd: str) -> list[str]:
    tags = []
    text = (title + " " + jd).lower()
    tag_map = {
        "remote": ["remote", "work from home", "wfh"],
        "sql": ["sql"],
        "python": ["python"],
        "excel": ["excel"],
        "tableau": ["tableau"],
        "power-bi": ["power bi", "powerbi"],
        "spark": ["spark", "pyspark"],
        "aws": ["aws", "amazon web services"],
        "azure": ["azure"],
        "gcp": ["gcp", "google cloud"],
        "dbt": ["dbt"],
        "airflow": ["airflow"],
        "full-time": ["full time", "full-time"],
        "part-time": ["part time", "part-time"],
        "contract": ["contract", "freelance"],
        "entry-level": ["entry level", "junior", "fresher", "0-2 years", "1-2 years"],
        "senior": ["senior", "lead", "principal", "sr."],
    }
    for tag, keywords in tag_map.items():
        if any(kw in text for kw in keywords):
            tags.append(tag)
    return tags


# Experience-level patterns (checked in order — most specific first)
_EXPERIENCE_PATTERNS = [
    # Entry / Junior / Fresher
    ("entry", [
        r"\bentry[- ]level\b", r"\bjunior\b", r"\bjr\.?\b",
        r"\bfresher\b", r"\bgraduate\b", r"\b0[- ]?(?:to|[-–])[- ]?[12][- ]?year",
        r"\bno experience\b", r"\bnew grad\b",
    ]),
    # Senior / Lead / Principal / Staff
    ("senior", [
        r"\bsenior\b", r"\bsr\.?\b", r"\blead\b", r"\bprincipal\b",
        r"\bstaff\b", r"\bhead of\b", r"\bdirector\b",
        r"\b[5-9][- ]?(?:to|[-–])[- ]?\d+[- ]?year",
        r"\b\d{2,}[- ]?(?:to|[-–])[- ]?\d+[- ]?year",
    ]),
    # Mid-level (explicit markers only — avoid false positives)
    ("mid", [
        r"\bmid[- ]level\b", r"\bintermediate\b", r"\bassociate\b",
        r"\b[23][- ]?(?:to|[-–])[- ]?[45][- ]?year",
        r"\b[23]\+[- ]?years\b",
    ]),
]


def extract_experience(title: str, jd: str) -> str | None:
    """Return 'entry', 'mid', or 'senior'; None if undetermined."""
    text = (title + " " + jd).lower()
    for level, patterns in _EXPERIENCE_PATTERNS:
        if any(re.search(p, text) for p in patterns):
            return level
    return None


def _parse_date(raw) -> str | None:
    if not raw:
        return None
    if isinstance(raw, (int, float)):
        return datetime.fromtimestamp(raw, tz=timezone.utc).isoformat()
    try:
        return dateutil_parser.parse(str(raw)).isoformat()
    except Exception:
        return None


def normalize_arbeitnow(raw: dict) -> dict:
    title = raw.get("title", "")
    jd = raw.get("description", "")
    return {
        "title": title,
        "company": raw.get("company_name", ""),
        "location": raw.get("location", "Remote" if raw.get("remote") else ""),
        "jd_text": jd,
        "posted_date": _parse_date(raw.get("created_at")),
        "source": "arbeitnow",
        "apply_url": raw.get("url", ""),
        "tags": tag_job(title, jd),
        "role_category": categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id": str(raw.get("slug", "")),
    }


def normalize_remoteok(raw: dict) -> dict:
    title = raw.get("position", "")
    jd = re.sub(r"<[^>]+>", " ", raw.get("description", ""))  # strip HTML
    return {
        "title": title,
        "company": raw.get("company", ""),
        "location": "Remote",  # RemoteOK is all-remote
        "jd_text": jd,
        "posted_date": _parse_date(raw.get("date")),
        "source": "remoteok",
        "apply_url": raw.get("url", ""),
        "tags": tag_job(title, jd) + ["remote"],
        "role_category": categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id": str(raw.get("id", "")),
    }


def normalize_adzuna(raw: dict) -> dict:
    title = raw.get("title", "")
    jd = raw.get("description", "")
    loc = raw.get("location", {}).get("display_name", "")
    return {
        "title": title,
        "company": raw.get("company", {}).get("display_name", ""),
        "location": loc,
        "jd_text": jd,
        "posted_date": _parse_date(raw.get("created")),
        "source": "adzuna",
        "apply_url": raw.get("redirect_url", ""),
        "tags": tag_job(title, jd),
        "role_category": categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id": str(raw.get("id", "")),
    }


def normalize_jooble(raw: dict) -> dict:
    title = raw.get("title", "")
    jd = re.sub(r"<[^>]+>", " ", raw.get("snippet", ""))  # strip HTML
    location = raw.get("location", "")
    # Jooble marks remote jobs with type field
    job_type = raw.get("type", "")
    if "remote" in job_type.lower() or "remote" in location.lower():
        if "remote" not in location.lower():
            location = location + " (Remote)" if location else "Remote"
    return {
        "title": title,
        "company": raw.get("company", ""),
        "location": location,
        "jd_text": jd,
        "posted_date": _parse_date(raw.get("updated")),
        "source": "jooble",
        "apply_url": raw.get("link", ""),
        "tags": tag_job(title, jd),
        "role_category": categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id": str(raw.get("id", "")),
    }


NORMALIZERS = {
    "arbeitnow": normalize_arbeitnow,
    "remoteok":  normalize_remoteok,
    "adzuna":    normalize_adzuna,
    "jooble":    normalize_jooble,
}
