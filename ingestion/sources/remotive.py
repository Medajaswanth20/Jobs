"""
Remotive API source - free, no API key required.
Docs: https://remotive.com/api/remote-jobs
"""
import requests
from typing import Iterator

BASE_URL = "https://remotive.com/api/remote-jobs"

CATEGORIES = [
    "software-dev",
    "data",
    "devops-sysadmin",
    "product",
    "design",
    "qa",
]

KEYWORDS = [
    "engineer", "developer", "analyst", "scientist", "manager", "designer",
    "architect", "administrator", "dba", "database", "sql", "devops",
    "platform", "cloud", "sre", "fullstack", "full stack", "frontend",
    "backend", "product", "ui", "ux", "data", "ml", "mlops",
]


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from Remotive API (no key needed)."""
    seen_ids: set = set()
    for category in CATEGORIES:
        try:
            resp = requests.get(
                BASE_URL,
                params={"category": category},
                timeout=20,
                headers={"User-Agent": "JobAggregator/1.0"},
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[remotive] {category} error: {e}")
            continue
        data = resp.json()
        jobs = data.get("jobs", [])
        print(f"[remotive] {category}: {len(jobs)} jobs")
        for job in jobs:
            job_id = job.get("id")
            if job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            title = (job.get("title") or "").lower()
            tags = " ".join(job.get("tags") or []).lower()
            combined = title + " " + tags
            if any(kw in combined for kw in KEYWORDS):
                yield job
