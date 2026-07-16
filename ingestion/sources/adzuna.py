"""
Adzuna API source — free tier, requires APP_ID + APP_KEY.
Docs: https://developer.adzuna.com/
"""
import os
import requests
from typing import Iterator

BASE_URL = "https://api.adzuna.com/v1/api/jobs"
APP_ID = os.environ.get("ADZUNA_APP_ID", "")
APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")

SEARCH_TERMS = [
    "data analyst",
    "data integrity analyst",
    "data engineer",
    "analytics engineer",
    "business analyst data",
    "data quality analyst",
]

# Countries to fetch from (add/remove as needed)
COUNTRIES = ["in", "gb", "us"]


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from Adzuna across configured countries and terms."""
    if not APP_ID or not APP_KEY:
        print("[adzuna] skipping — ADZUNA_APP_ID / ADZUNA_APP_KEY not set")
        return

    for country in COUNTRIES:
        for term in SEARCH_TERMS:
            page = 1
            while page <= 3:  # max 3 pages per term to stay within free tier limits
                url = f"{BASE_URL}/{country}/search/{page}"
                params = {
                    "app_id": APP_ID,
                    "app_key": APP_KEY,
                    "what": term,
                    "results_per_page": 50,
                    "sort_by": "date",
                    "content-type": "application/json",
                }
                try:
                    resp = requests.get(url, params=params, timeout=15,
                                        headers={"User-Agent": "JobAggregator/1.0"})
                    resp.raise_for_status()
                except requests.RequestException as e:
                    print(f"[adzuna] {country}/{term} page {page} failed: {e}")
                    break

                data = resp.json()
                results = data.get("results", [])
                if not results:
                    break
                for job in results:
                    yield job
                page += 1
