# DataJobs — Legal Job Aggregation Platform

A real-time job board for data professionals. Aggregates listings from **5 public job APIs** (Adzuna, Arbeitnow, RemoteOK, Jooble, SerpAPI/Google Jobs), stores them in Supabase, and serves them through a modern Next.js frontend.

> **Live sources include Naukri, LinkedIn, Indeed, and Glassdoor** via SerpAPI's Google Jobs index.

---

## Project Structure

```
job-aggregator/
├── .github/
│   └── workflows/
│       └── ingest.yml          ← GitHub Actions scheduler (every 4h)
├── ingestion/                  ← Python ingestion service
│   ├── main.py                 ← Entry point
│   ├── normalizer.py           ← Maps raw API → common schema
│   ├── deduper.py              ← Hash-based dedup
│   ├── upserter.py             ← Supabase upsert
│   ├── requirements.txt
│   └── sources/
│       ├── arbeitnow.py        ← Free, no key required
│       ├── remoteok.py         ← Free, no key required
│       ├── adzuna.py           ← Free tier (requires APP_ID + APP_KEY)
│       ├── jooble.py           ← Free tier (requires JOOBLE_API_KEY)
│       └── serpapi.py          ← Google Jobs: Naukri, LinkedIn, Indeed, Glassdoor
├── frontend/                   ← Next.js 14 app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            ← Main job board UI
│   │   └── globals.css         ← Full design system
│   └── lib/
│       └── supabase.ts         ← Typed Supabase client + query helpers
├── schema.sql                  ← Paste into Supabase SQL Editor
└── README.md
```

---

## Setup

### 1. Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and paste the contents of `schema.sql` → Run
3. Note your **Project URL** and **Anon Key** (from Settings → API)

### 2. Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

### 3. Ingestion (local test)
```bash
cd ingestion
pip install -r requirements.txt

# Copy and fill in your keys
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Adzuna (free tier) — https://developer.adzuna.com
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-app-key

# Jooble (free) — https://jooble.org/api/about
JOOBLE_API_KEY=your-jooble-key

# SerpAPI (100 searches/month free) — https://serpapi.com
SERPAPI_KEY=your-serpapi-key
```

Then run:
```bash
python main.py
```

### 4. GitHub Actions (automated ingestion)
1. Push this repo to GitHub
2. Go to **Settings → Secrets → Actions** and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `ADZUNA_APP_ID`
   - `ADZUNA_APP_KEY`
   - `JOOBLE_API_KEY`
   - `SERPAPI_KEY`
3. The workflow runs every 4 hours automatically.  
   Trigger it manually via **Actions → Job Ingestion → Run workflow**

---

## API Sources

| Source | Key Required | Coverage | Free Tier |
|---|---|---|---|
| [Arbeitnow](https://www.arbeitnow.com/api) | No | EU-focused | Unlimited |
| [RemoteOK](https://remoteok.com/api) | No | Global remote | Unlimited |
| [Adzuna](https://developer.adzuna.com) | Yes | IN, GB, US | 250 req/month |
| [Jooble](https://jooble.org/api/about) | Yes | India + Global | Generous free tier |
| [SerpAPI](https://serpapi.com/google-jobs-api) | Yes | **Naukri, LinkedIn, Indeed, Glassdoor** | 100 searches/month |

---

## Role Categories

| Category | Keywords Matched |
|---|---|
| `data-integrity` | data integrity, data quality, dq analyst, data governance |
| `data-engineer` | data engineer, etl, pipeline engineer, data platform |
| `analytics-engineer` | analytics engineer, dbt |
| `business-analyst` | business analyst, bi analyst, reporting analyst |
| `data-scientist` | data scientist, ml engineer, machine learning |
| `data-analyst` | data analyst, analyst (broad catch-all) |

---

## Phase 2 (Planned)
- Gmail API integration to parse LinkedIn/Naukri job alert emails
- Company career page scrapers (static HTML only)
- User accounts + saved jobs
