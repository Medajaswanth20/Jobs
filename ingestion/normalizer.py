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
    ("devops",              ["devops", "devsecops", "site reliability", "sre", "platform engineer",
                             "infrastructure engineer", "systems reliability", "release engineer"]),
    ("cloud-engineer",      ["cloud engineer", "cloud architect", "aws engineer", "azure engineer",
                             "gcp engineer", "solutions architect", "cloud developer"]),
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
        "kubernetes": ["kubernetes", "k8s"],
        "docker":     ["docker", "container"],
        "terraform":  ["terraform", "iac", "infrastructure as code"],
        "ci-cd":      ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci", "circle ci"],
        "linux":      ["linux", "unix", "bash", "shell script"],
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
        r"\bfresher\b", r"\bgraduate\b", r"\b0(?!\d)[- ]?(?:to|[-\u2013])[- ]?[12][- ]?year",
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
    """Return 'entry', 'mid', or 'senior'; None if undetermined.

    Uses a scoring approach so that strong signals (especially in the title)
    override weaker ones.  A senior signal in the *title* always wins, because
    a job posted as "Sr. Analyst" or "Technical Lead" is never entry-level
    even if the JD body happens to mention "entry level applicants welcome".
    """
    title_lower = title.lower()
    body_lower  = jd.lower()

    scores: dict[str, int] = {"entry": 0, "mid": 0, "senior": 0}

    for level, patterns in _EXPERIENCE_PATTERNS:
        for p in patterns:
            if re.search(p, title_lower):
                scores[level] += 3          # title hit — high weight
            elif re.search(p, body_lower):
                scores[level] += 1          # body-only hit — lower weight

    # No signal at all
    if max(scores.values()) == 0:
        return None

    # Senior title signal is decisive — prevents "Sr. Lead" from being
    # overridden by an "entry level" mention buried in the JD body.
    senior_title_hit = any(
        re.search(p, title_lower)
        for p in _EXPERIENCE_PATTERNS[1][1]   # index 1 == senior
    )
    if senior_title_hit:
        return "senior"

    return max(scores, key=lambda k: scores[k])


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


def normalize_serpapi(raw: dict) -> dict:
    """Normalize a SerpAPI Google Jobs result dict."""
    title = raw.get("title", "")
    # SerpAPI returns description in highlights or as a plain snippet
    jd = raw.get("description", "")
    if not jd:
        # fallback: join highlights snippets
        highlights = raw.get("job_highlights", [])
        jd = " ".join(
            item for h in highlights for item in h.get("items", [])
        )

    location = raw.get("location", "")
    extensions = raw.get("detected_extensions", {})

    # Work type / schedule
    schedule = extensions.get("schedule_type", "")
    if "remote" in schedule.lower() or "remote" in location.lower():
        if "remote" not in location.lower():
            location = (location + " (Remote)") if location else "Remote"

    # Best apply link: prefer direct apply, then first option
    apply_url = ""
    apply_options = raw.get("apply_options", [])
    direct = [o for o in apply_options if o.get("title", "").lower() == "direct apply"]
    if direct:
        apply_url = direct[0].get("link", "")
    elif apply_options:
        apply_url = apply_options[0].get("link", "")

    posted_raw = extensions.get("posted_at") or extensions.get("date_posted")

    return {
        "title":            title,
        "company":          raw.get("company_name", ""),
        "location":         location,
        "jd_text":          jd,
        "posted_date":      _parse_date(posted_raw),
        "source":           "serpapi",
        "apply_url":        apply_url,
        "tags":             tag_job(title, jd),
        "role_category":    categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id":        str(raw.get("job_id", "")),
    }


def normalize_jsearch(raw: dict) -> dict:
    """Normalize a JSearch (Google Jobs / RapidAPI) job dict."""
    title = raw.get("job_title", "")
    jd    = re.sub(r"<[^>]+>", " ", raw.get("job_description", ""))  # strip any HTML

    # Build location string from structured fields
    city    = raw.get("job_city", "")
    state   = raw.get("job_state", "")
    country = raw.get("job_country", "")
    location_parts = [p for p in [city, state, country] if p]
    location = ", ".join(location_parts)

    # JSearch explicitly flags remote jobs
    is_remote = raw.get("job_is_remote", False)
    if is_remote:
        location = (location + " (Remote)") if location else "Remote"

    return {
        "title":            title,
        "company":          raw.get("employer_name", ""),
        "location":         location,
        "jd_text":          jd,
        "posted_date":      _parse_date(raw.get("job_posted_at_datetime_utc")),
        "source":           "jsearch",
        "apply_url":        raw.get("job_apply_link", ""),
        "tags":             tag_job(title, jd),
        "role_category":    categorize(title, jd),
        "experience_level": extract_experience(title, jd),
        "source_id":        str(raw.get("job_id", "")),
    }


NORMALIZERS = {
    "arbeitnow": normalize_arbeitnow,
    "remoteok":  normalize_remoteok,
    "adzuna":    normalize_adzuna,
    "jooble":    normalize_jooble,
    "jsearch":   normalize_jsearch,   # kept for reference; disabled in main.py
    "serpapi":   normalize_serpapi,
}
