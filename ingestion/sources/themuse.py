"""
The Muse API source - free, no API key required.
Docs: https://www.themuse.com/developers/api/v2
Returns tech, PM, design, and engineering roles globally.
"""
import time
import requests
from typing import Iterator

BASE_URL = "https://www.themuse.com/api/public/jobs"

CATEGORIES = [
    "Data Science",
    "Software Engineer",
    "Engineering",
    "Product Management",
    "Design & UX",
    "IT",
]

KEYWORDS = [
    "engineer", "developer", "analyst", "scientist", "manager", "designer",
    "architect", "administrator", "dba", "database", "sql", "devops",
    "platform", "cloud", "sre", "fullstack", "full stack", "frontend",
    "backend", "product", "ui", "ux", "data", "software", "ml", "mlops",
]

MAX_PAGES = 3
PAGE_DELAY = 0.5


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from The Muse API (no key needed)."""
    seen_ids: set = set()
    for category in CATEGORIES:
        for page in range(1, MAX_PAGES + 1):
            try:
                resp = requests.get(
                    BASE_URL,
                    params={"category": category, "page": page, "per_page": 100},
                    timeout=20,
                    headers={"User-Agent": "JobAggregator/1.0"},
                )
                resp.raise_for_status()
            except requests.RequestException as e:
                print(f"[themuse] {category} page {page} error: {e}")
                break
            data = resp.json()
            results = data.get("results", [])
            if not results:
                break
            for job in results:
                job_id = job.get("id")
                if job_id in seen_ids:
                    continue
                seen_ids.add(job_id)
                title = (job.get("name") or "").lower()
                if any(kw in title for kw in KEYWORDS):
                    yield job
            if len(results) < 100:
                break
            time.sleep(PAGE_DELAY)
