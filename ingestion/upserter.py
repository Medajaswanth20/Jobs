"""
Upserts normalized job dicts into Supabase.
Uses the 'hash' column as the conflict target — safe to run repeatedly.
"""
import os
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def get_existing_hashes() -> set[str]:
    """Fetches all known hashes from the DB to support deduplication."""
    client = get_client()
    # Paginate in chunks of 1000
    hashes = set()
    page = 0
    while True:
        resp = client.table("jobs").select("hash").range(page * 1000, (page + 1) * 1000 - 1).execute()
        rows = resp.data or []
        for r in rows:
            if r.get("hash"):
                hashes.add(r["hash"])
        if len(rows) < 1000:
            break
        page += 1
    return hashes


def upsert_jobs(jobs: list[dict]) -> int:
    """
    Upserts a batch of normalized job dicts.
    Returns the number of rows inserted/updated.
    """
    if not jobs:
        return 0
    client = get_client()
    # Supabase upsert with on_conflict='hash'
    resp = client.table("jobs").upsert(jobs, on_conflict="hash").execute()
    return len(resp.data or [])


def expire_old_jobs() -> None:
    """Calls the Postgres function to mark old jobs inactive."""
    client = get_client()
    client.rpc("expire_old_jobs").execute()
