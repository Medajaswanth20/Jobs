"""
Ingestion entry point — run by GitHub Actions every 4 hours.
Fetches from all sources, normalizes, dedupes, and upserts to Supabase.
"""
import os, time

# Load .env for local runs (GitHub Actions uses secrets instead)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from sources import arbeitnow, remoteok, adzuna, jooble, serpapi
from normalizer import NORMALIZERS
from deduper import compute_hash, dedupe_batch
from upserter import get_existing_hashes, upsert_jobs, expire_old_jobs

SOURCES = [
    ("arbeitnow", arbeitnow.fetch_jobs),
    ("remoteok",  remoteok.fetch_jobs),
    ("adzuna",    adzuna.fetch_jobs),
    ("jooble",    jooble.fetch_jobs),
    ("serpapi",   serpapi.fetch_jobs),  # Google Jobs → Naukri, LinkedIn, Indeed
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

        normalizer = NORMALIZERS[source_name]
        normalized = []
        for raw in raw_jobs:
            try:
                job = normalizer(raw)
                job["hash"] = compute_hash(job)
                normalized.append(job)
            except Exception as e:
                print(f"  [warn] normalize error: {e}")

        all_jobs.extend(normalized)
        time.sleep(1)  # be polite between sources

    # Dedupe across all sources + against existing DB
    new_jobs = dedupe_batch(all_jobs, existing_hashes)
    print(f"\nTotal fetched: {len(all_jobs)} | New after dedup: {len(new_jobs)}")

    # Upsert in batches of 500
    batch_size = 500
    total_inserted = 0
    for i in range(0, len(new_jobs), batch_size):
        batch = new_jobs[i:i + batch_size]
        count = upsert_jobs(batch)
        total_inserted += count
        print(f"  Upserted batch {i // batch_size + 1}: {count} rows")

    print(f"\nTotal upserted: {total_inserted}")

    print("\nExpiring old jobs (>30 days)...")
    expire_old_jobs()

    print("\n=== Ingestion Complete ===")


if __name__ == "__main__":
    run()
