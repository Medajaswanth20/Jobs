"""
One-time cleanup script: re-classifies experience_level for all jobs in the
database using the fixed extract_experience() function.

Run from the ingestion/ directory:
    python fix_experience_levels.py
"""
import os, sys
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client
from normalizer import extract_experience

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PAGE = 1000   # rows per fetch

def fix_all():
    updated = 0
    offset  = 0

    while True:
        resp = (
            supabase.table("jobs")
            .select("id, title, jd_text, experience_level")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows = resp.data
        if not rows:
            break

        for row in rows:
            correct = extract_experience(row["title"] or "", row["jd_text"] or "")
            if correct != row["experience_level"]:
                supabase.table("jobs").update({"experience_level": correct}).eq("id", row["id"]).execute()
                print(f"  Fixed [{row['id'][:8]}] '{row['title']}': "
                      f"{row['experience_level']!r} -> {correct!r}")
                updated += 1

        offset += PAGE
        if len(rows) < PAGE:
            break

    print(f"\nDone. {updated} job(s) reclassified.")

if __name__ == "__main__":
    print("Scanning all jobs and fixing experience_level…\n")
    fix_all()
