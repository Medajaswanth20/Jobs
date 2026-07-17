"""
JSearch (RapidAPI) source — aggregates Google Jobs which indexes
Naukri, LinkedIn, Indeed, Glassdoor, and 100+ other job boards.

Free tier: 200 requests/month  |  Basic: 500 req/month
API docs : https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
Sign up  : https://rapidapi.com/  → search "JSearch" → Subscribe (free)
"""
import os
import time
import requests
from typing import Iterator

API_KEY  = os.environ.get("JSEARCH_API_KEY", "")
BASE_URL = "https://jsearch.p.rapidapi.com/search"

# Search queries — these mirror what a job-seeker would type on Google Jobs
QUERIES = [
    "data analyst jobs in India",
    "data integrity analyst India",
    "data quality analyst India",
    "data engineer jobs India",
    "analytics engineer India",
    "business analyst data India",
    "data analyst remote",
]

MAX_PAGES      = 2    # 2 pages × 7 queries = 14 req/run — safe for 200/month free tier
PAGE_SIZE      = 10   # JSearch default page size
REQUEST_DELAY  = 1.5  # seconds between requests (free tier rate limit ~1 req/sec)
RETRY_DELAY    = 10   # seconds to wait on 429 before retrying once


def _get(params: dict, headers: dict) -> dict | None:
    """Single GET with one 429 retry."""
    for attempt in range(2):
        try:
            resp = requests.get(BASE_URL, headers=headers, params=params, timeout=20)
            if resp.status_code == 429:
                if attempt == 0:
                    print(f"[jsearch] 429 rate-limit hit — waiting {RETRY_DELAY}s then retrying...")
                    time.sleep(RETRY_DELAY)
                    continue
                print("[jsearch] 429 after retry — skipping this query page")
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as e:
            print(f"[jsearch] HTTP {e.response.status_code} — skipping")
            return None
        except requests.RequestException as e:
            print(f"[jsearch] request error: {e} — skipping")
            return None
    return None


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from JSearch (Google Jobs index)."""
    if not API_KEY:
        print("[jsearch] skipping — JSEARCH_API_KEY not set")
        return

    headers = {
        "X-RapidAPI-Key":  os.environ.get("JSEARCH_API_KEY", API_KEY),
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    for query in QUERIES:
        for page in range(1, MAX_PAGES + 1):
            params = {
                "query":       query,
                "page":        str(page),
                "num_pages":   "1",
                "date_posted": "month",   # last 30 days only
                "country":     "in",      # bias toward India
                "language":    "en",
            }

            time.sleep(REQUEST_DELAY)    # respect rate limit before every request

            data = _get(params, headers)
            if data is None:
                break

            jobs = data.get("data", [])
            if not jobs:
                break

            for job in jobs:
                yield job

            if len(jobs) < PAGE_SIZE:
                break  # no further pages for this query

