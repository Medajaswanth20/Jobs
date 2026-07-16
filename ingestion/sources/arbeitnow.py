"""
Arbeitnow API source — no API key required.
Docs: https://www.arbeitnow.com/api
"""
import requests
from typing import Iterator

BASE_URL = "https://www.arbeitnow.com/api/job-board-api"
KEYWORDS = ["data analyst", "data integrity", "data engineer", "analytics engineer",
            "business analyst", "data quality", "bi analyst", "data science"]


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from Arbeitnow (paginated)."""
    page = 1
    while True:
        try:
            resp = requests.get(BASE_URL, params={"page": page}, timeout=15,
                                headers={"User-Agent": "JobAggregator/1.0 (personal project)"})
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[arbeitnow] request failed on page {page}: {e}")
            break

        data = resp.json()
        jobs = data.get("data", [])
        if not jobs:
            break

        for job in jobs:
            title = (job.get("title") or "").lower()
            if any(kw in title for kw in KEYWORDS):
                yield job

        # Arbeitnow paginates up to ~20 pages; stop at last page
        links = data.get("links", {})
        if not links.get("next"):
            break
        page += 1
