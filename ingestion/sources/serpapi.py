"""
SerpAPI Google Jobs source — pulls from Naukri, LinkedIn, Indeed, Glassdoor etc.
Free tier: 100 searches/month (~1,000 jobs)
Docs: https://serpapi.com/google-jobs-api
Sign up: https://serpapi.com/users/sign_up

NOTE: SerpAPI free tier is very limited (100–250 searches/month).
      This source is disabled by default to preserve credits.
      Set SERPAPI_ENABLED=true in your environment to turn it on.
      JSearch (jsearch.py) covers the same Google Jobs data for free.
"""
import os
import time
import requests
from typing import Iterator

API_KEY  = os.environ.get("SERPAPI_KEY", "")
ENABLED  = os.environ.get("SERPAPI_ENABLED", "false").lower() == "true"
BASE_URL = "https://serpapi.com/search.json"

# Reduced query list — only roles NOT covered by JSearch to avoid overlap
# JSearch already covers: data analyst, data engineer, analytics engineer, business analyst, data analyst remote
# SerpAPI adds: roles that need Google Jobs' Indian geolocation specifically
QUERIES = [
    "data scientist jobs India",
    "devops engineer jobs India",
    "cloud engineer AWS Azure India",
    "site reliability engineer India",
]

RESULTS_PER_PAGE = 10
MAX_PAGES        = 1    # 1 page × 4 queries = 4 req/run
REQUEST_DELAY    = 1.0  # seconds between requests


def fetch_jobs() -> Iterator[dict]:
    """Yields raw Google Jobs result dicts from SerpAPI.
    Skipped entirely unless SERPAPI_ENABLED=true is set in environment.
    """
    if not ENABLED:
        print("[serpapi] skipped — set SERPAPI_ENABLED=true to enable (uses credit quota)")
        return

    if not API_KEY:
        print("[serpapi] skipping — SERPAPI_KEY not set")
        return

    key = os.environ.get("SERPAPI_KEY", API_KEY)

    for query in QUERIES:
        for page in range(MAX_PAGES):
            params = {
                "engine":   "google_jobs",
                "q":        query,
                "api_key":  key,
                "start":    page * RESULTS_PER_PAGE,
                "chips":    "date_posted:month",
                "hl":       "en",
                "gl":       "in",
            }

            time.sleep(REQUEST_DELAY)

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

            if "error" in data:
                print(f"[serpapi] API error for '{query}': {data['error']} — stopping to preserve credits")
                return  # stop entirely on quota error

            jobs = data.get("jobs_results", [])
            if not jobs:
                break

            for job in jobs:
                yield job

            if len(jobs) < RESULTS_PER_PAGE:
                break
