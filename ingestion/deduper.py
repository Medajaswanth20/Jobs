"""
Deduplication logic — hash-based to prevent duplicate rows across sources.
"""
import hashlib
import re


def _clean(s: str) -> str:
    """Lowercase, strip punctuation and extra whitespace."""
    s = (s or "").lower()
    s = re.sub(r"[^\w\s]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def compute_hash(job: dict) -> str:
    """
    Stable hash on company + title + location.
    Same job posted on Adzuna and Arbeitnow will get the same hash → deduped.
    """
    key = _clean(job.get("company", "")) + "|" + \
          _clean(job.get("title", "")) + "|" + \
          _clean(job.get("location", ""))
    return hashlib.sha256(key.encode()).hexdigest()


def dedupe_batch(jobs: list[dict], existing_hashes: set[str]) -> list[dict]:
    """
    Returns only jobs whose hash is NOT already in existing_hashes.
    Also dedupes within the current batch itself.
    """
    seen = set(existing_hashes)
    result = []
    for job in jobs:
        h = job.get("hash") or compute_hash(job)
        job["hash"] = h
        if h not in seen:
            seen.add(h)
            result.append(job)
    return result
