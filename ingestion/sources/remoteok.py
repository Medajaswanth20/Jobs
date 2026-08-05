"""
RemoteOK API source — free, no key required.
Docs: https://remoteok.com/api
"""
import time
import requests
from typing import Iterator

BASE_URL = "https://remoteok.com/api"
KEYWORDS = [
    # Data roles
    "data analyst", "data integrity", "data engineer", "analytics engineer",
    "business analyst", "data quality", "bi analyst", "data science",
    # Software Engineering
    "software engineer", "software developer", "full stack", "fullstack",
    "frontend engineer", "frontend developer", "backend engineer", "backend developer",
    "react developer", "node developer", "python developer", "java developer",
    # DevOps / Cloud
    "devops", "site reliability", "sre", "cloud engineer", "platform engineer",
    "kubernetes", "infrastructure engineer",
    # Product & Design
    "product manager", "product owner", "ui/ux", "ux designer", "ui designer",
    "product designer", "interaction designer",
    # Database roles
    "database administrator", "dba", "sql developer", "database engineer",
    "database analyst", "db analyst", "database developer", "database architect",
    "postgresql developer", "mysql developer", "mongodb developer",
]


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from RemoteOK filtered by keywords."""
    # RemoteOK requires a short delay before requests to be a good citizen
    time.sleep(2)
    try:
        resp = requests.get(BASE_URL, timeout=20,
                            headers={"User-Agent": "JobAggregator/1.0 (personal project)"})
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[remoteok] request failed: {e}")
        return

    jobs = resp.json()
    # First item is a legal notice dict, skip it
    if jobs and isinstance(jobs[0], dict) and "legal" in jobs[0]:
        jobs = jobs[1:]

    for job in jobs:
        title = (job.get("position") or "").lower()
        tags = [t.lower() for t in (job.get("tags") or [])]
        combined = title + " ".join(tags)
        if any(kw in combined for kw in KEYWORDS):
            yield job
