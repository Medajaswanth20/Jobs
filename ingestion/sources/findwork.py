"""
Findwork API source - free tier, no API key required for basic access.
Docs: https://findwork.dev/api/
Returns dev, DevOps, data, and database roles globally.
"""
import time
import requests
from typing import Iterator

BASE_URL = "https://findwork.dev/api/jobs/"

SEARCH_TERMS = [
    "data analyst",
    "data engineer",
    "software engineer",
    "frontend developer",
    "backend developer",
    "fullstack developer",
    "devops engineer",
    "cloud engineer",
    "database administrator",
    "database analyst",
    "sql developer",
    "database engineer",
    "product manager",
    "ux designer",
    "machine learning engineer",
]

REQUEST_DELAY = 1.0


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from Findwork API."""
    seen_ids: set = set()
    for term in SEARCH_TERMS:
        time.sleep(REQUEST_DELAY)
        try:
            resp = requests.get(
                BASE_URL,
                params={"search": term},
                timeout=20,
                headers={
                    "User-Agent": "JobAggregator/1.0",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[findwork] search {term!r} error: {e}")
            continue
        data = resp.json()
        jobs = data.get("results", [])
        print(f"[findwork] search {term!r}: {len(jobs)} jobs")
        for job in jobs:
            job_id = job.get("id")
            if job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            yield job
