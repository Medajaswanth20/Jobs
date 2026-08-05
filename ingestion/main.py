"""
Ingestion entry point — run by GitHub Actions every 4 hours.
Fetches from all sources, normalizes, dedupes, and upserts to Supabase.
"""
import os, time
from datetime import datetime, timezone

# Load .env for local runs (GitHub Actions uses secrets instead)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from sources import arbeitnow, remoteok, adzuna, jooble, remotive, themuse, jobicy
# serpapi disabled — free tier (100 searches/month) exhausted.
# Re-enable by upgrading to a paid SerpAPI plan and uncommenting below.
# from sources import serpapi
from normalizer import NORMALIZERS
from deduper import compute_hash, dedupe_within_batch
from upserter import get_existing_hashes, upsert_jobs, expire_old_jobs, expire_stale_jobs

SOURCES = [
    ("arbeitnow", arbeitnow.fetch_jobs),
    ("remoteok",  remoteok.fetch_jobs),
    ("adzuna",    adzuna.fetch_jobs),
    ("jooble",    jooble.fetch_jobs),
    # ("serpapi", serpapi.fetch_jobs),  # disabled — quota exhausted
    ("remotive",  remotive.fetch_jobs),   # free, no key — remote tech roles
    ("themuse",   themuse.fetch_jobs),    # free, no key — tech/PM/design
    ("jobicy",    jobicy.fetch_jobs),     # free, no key — remote roles by tag
]


def run():
    print("=== Job Ingestion Started ===")
    print("Fetching existing hashes from DB...")
    existing_hashes = get_existing_hashes()
    print(f"  Known hashes: {len(existing_hashes)}")

    all_jobs = []

    for source_name, fetch_fn in SOURCES:
        print(f"\n[{source_name}] Fetching...")
        raw_jobs = list(fetch_fn())
        print(f"[{source_name}] Fetched {len(raw_jobs)} raw jobs")

        now = datetime.now(timezone.utc).isoformat()
        normalizer = NORMALIZERS[source_name]
        normalized = []
        for raw in raw_jobs:
            try:
                job = normalizer(raw)
                job["hash"] = compute_hash(job)
                # Every job seen this run is re-stamped so still-open
                # listings don't get expired by expire_stale_jobs().
                job["last_seen_at"] = now
                job["is_active"] = True
                normalized.append(job)
            except Exception as e:
                print(f"  [warn] normalize error: {e}")

        all_jobs.extend(normalized)
        time.sleep(1)  # be polite between sources

    # Dedupe within this run (same job posted on two sources)
    unique_jobs = dedupe_within_batch(all_jobs)
    new_count = sum(1 for j in unique_jobs if j["hash"] not in existing_hashes)
    print(f"\nTotal fetched: {len(all_jobs)} | Unique: {len(unique_jobs)} | New: {new_count}")

    # Upsert everyone seen this run — not just new jobs — so previously
    # known jobs get their last_seen_at refreshed and stay active.
    batch_size = 500
    total_upserted = 0
    for i in range(0, len(unique_jobs), batch_size):
        batch = unique_jobs[i:i + batch_size]
        count = upsert_jobs(batch)
        total_upserted += count
        print(f"  Upserted batch {i // batch_size + 1}: {count} rows")

    print(f"\nTotal upserted: {total_upserted}")

    print("\nExpiring stale jobs (missing from source feed for 3+ days)...")
    expire_stale_jobs()

    print("Expiring old jobs (>30 days since posted)...")
    expire_old_jobs()

    print("\n=== Ingestion Complete ===")


if __name__ == "__main__":
    run()
