"""
SerpAPI Google Jobs source — pulls from Naukri, LinkedIn, Indeed, Glassdoor etc.
Free tier: 100 searches/month (~1,000 jobs)
Docs: https://serpapi.com/google-jobs-api
Sign up: https://serpapi.com/users/sign_up
"""
import os
import time
import requests
from typing import Iterator

API_KEY  = os.environ.get("SERPAPI_KEY", "")
BASE_URL = "https://serpapi.com/search.json"

# Search queries targeting Data + DevOps roles in India
QUERIES = [
    # Data roles
    "data analyst jobs in India",
    "data integrity analyst India",
    "data quality analyst India",
    "data engineer jobs India",
    "analytics engineer India",
    "business analyst data India",
    "data analyst remote India",
    # DevOps / Cloud roles
    "devops engineer jobs India",
    "site reliability engineer SRE India",
    "cloud engineer AWS Azure GCP India",
    "platform engineer kubernetes India",
    "devops engineer remote",
]

# SerpAPI Google Jobs returns ~10 results per page, paginated via `start` offset
RESULTS_PER_PAGE = 10
MAX_PAGES        = 1    # 1 page × 7 queries = 7 req/run → well within 100/month free tier
REQUEST_DELAY    = 1.0  # seconds between requests


def fetch_jobs() -> Iterator[dict]:
    """Yields raw Google Jobs result dicts from SerpAPI."""
    if not API_KEY:
        print("[serpapi] skipping — SERPAPI_KEY not set")
        return

    key = os.environ.get("SERPAPI_KEY", API_KEY)  # re-read in case env loaded after import

    for query in QUERIES:
        for page in range(MAX_PAGES):
            params = {
                "engine":   "google_jobs",
                "q":        query,
                "api_key":  key,
                "start":    page * RESULTS_PER_PAGE,  # pagination offset
                "chips":    "date_posted:month",       # last 30 days only
                "hl":       "en",
                "gl":       "in",                      # India geolocation
            }

            time.sleep(REQUEST_DELAY)  # be polite to rate limits

            try:
                resp = requests.get(BASE_URL, params=params, timeout=20)
                resp.raise_for_status()
            except requests.HTTPError as e:
                print(f"[serpapi] '{query}' page {page+1} HTTP {e.response.status_code} — skipping")
                break
            except requests.RequestException as e:
                print(f"[serpapi] '{query}' page {page+1} error: {e} — skipping")
                break

            data = resp.json()

            # Check for API-level errors
            if "error" in data:
                print(f"[serpapi] API error for '{query}': {data['error']}")
                break

            jobs = data.get("jobs_results", [])
            if not jobs:
                break  # no more results for this query

            for job in jobs:
                yield job

            if len(jobs) < RESULTS_PER_PAGE:
                break  # no further pages
