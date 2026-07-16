"""
Jooble API source — free, requires API key from https://jooble.org/api
Jooble aggregates jobs from Naukri, LinkedIn, Indeed, TimesJobs etc.
via legal partner agreements — great for India coverage.
"""
import os
import json
import urllib.request
import urllib.error
import ssl
from typing import Iterator

API_KEY = os.environ.get("JOOBLE_API_KEY", "")
BASE_URL = "https://jooble.org/api/{key}"

# Search terms targeting Data Analyst / Data Integrity roles
SEARCH_TERMS = [
    "data analyst",
    "data integrity analyst",
    "data quality analyst",
    "data engineer",
    "analytics engineer",
    "business analyst data",
]

# Locations to search (India-focused + remote)
LOCATIONS = ["India", "Remote"]

MAX_PAGES = 5          # Jooble free tier is generous; 5 pages × 20 results = 100/term
RESULTS_PER_PAGE = 20  # Jooble default page size


def fetch_jobs() -> Iterator[dict]:
    """Yields raw job dicts from Jooble across configured terms and locations."""
    if not API_KEY:
        print("[jooble] skipping — JOOBLE_API_KEY not set")
        return

    url = BASE_URL.format(key=API_KEY)
    ctx = ssl.create_default_context()

    for location in LOCATIONS:
        for term in SEARCH_TERMS:
            for page in range(1, MAX_PAGES + 1):
                payload = json.dumps({
                    "keywords": term,
                    "location": location,
                    "page": page,
                    "ResultsPerPage": RESULTS_PER_PAGE,
                }).encode("utf-8")

                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "JobAggregator/1.0",
                    },
                    method="POST",
                )

                try:
                    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as e:
                    print(f"[jooble] {location}/{term} page {page} HTTP error: {e.code}")
                    break
                except Exception as e:
                    print(f"[jooble] {location}/{term} page {page} error: {e}")
                    break

                jobs = data.get("jobs", [])
                if not jobs:
                    break  # no more results for this term/location

                for job in jobs:
                    yield job

                # If fewer results than page size, no need to fetch next page
                if len(jobs) < RESULTS_PER_PAGE:
                    break
