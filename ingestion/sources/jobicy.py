"""
Jobicy API source - free, no API key required.
Docs: https://jobicy.com/jobs-rss-feed
API:  https://jobicy.com/api/v2/remote-jobs
Returns remote tech, data, devops, product, design jobs globally.
"""
import time
import requests
from typing import Iterator

BASE_URL = "https://jobicy.com/api/v2/remote-jobs"

# Jobicy tag-based queries (tag= param filters by skill/role)
TAGS = [
    "data-analyst",
    "data-engineer",
    "software-engineer",
    "frontend",
    "backend",
    "devops",
    "cloud",
    "database",
    "sql",
    "product-manager",
    "ux-designer",
    "machine-learning",
]

REQUEST_DELAY = 1.0


def fetch_jobs() -> Iterator[dict]:
    seen_ids: set = set()
    # First fetch the general feed (up to 50 jobs, no tag filter)
    try:
        resp = requests.get(
            BASE_URL,
            params={"count": 50},
            timeout=20,
            headers={"User-Agent": "JobAggregator/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()
        jobs = data.get("jobs", [])
        print(f"[jobicy] general feed: {len(jobs)} jobs")
        for job in jobs:
            job_id = job.get("id")
            if job_id not in seen_ids:
                seen_ids.add(job_id)
                yield job
    except requests.RequestException as e:
        print(f"[jobicy] general feed error: {e}")
    # Then fetch by tag
    for tag in TAGS:
        time.sleep(REQUEST_DELAY)
        try:
            resp = requests.get(
                BASE_URL,
                params={"count": 50, "tag": tag},
                timeout=20,
                headers={"User-Agent": "JobAggregator/1.0"},
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[jobicy] tag {tag!r} error: {e}")
            continue
        data = resp.json()
        jobs = data.get("jobs", [])
        print(f"[jobicy] tag {tag!r}: {len(jobs)} jobs")
        for job in jobs:
            job_id = job.get("id")
            if job_id not in seen_ids:
                seen_ids.add(job_id)
                yield job
