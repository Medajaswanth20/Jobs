# Job Hub — Legal Job Aggregation Platform

A real-time job board for data & tech professionals. Aggregates listings from **6 public job APIs**, stores them in Supabase, and serves them through a modern Next.js frontend with **user authentication, personalised preferences, and an application tracker**.

> **Live sources include Naukri, LinkedIn, Indeed, and Glassdoor** via JSearch (RapidAPI Google Jobs index).

---

## Features

- 🔍 **Full-text search** across job titles, descriptions, and tags
- 🗂️ **Role filters** — Data Analyst, Data Engineer, Analytics Engineer, Data Scientist, Business Analyst, Data Integrity, DevOps/Cloud/SRE
- 🌍 **Country & location filters** — India, USA, UK, Australia, Canada, Germany, Singapore, UAE, and more
- ⏱️ **Experience level detection** — Entry / Mid / Senior auto-extracted from JD text
- 🏠 **Remote-only toggle**
- 👤 **User authentication** — Email/password + Google OAuth (Supabase Auth)
- ⚙️ **Personalised preferences** — Saved role, country, experience & remote preferences per user
- 📋 **Application tracker** — Log applications with status, ATS, resume, and email; export to Excel
- ⚡ **Automated ingestion** — GitHub Actions runs every 4 hours; deduplication via content hash
- 📱 **Responsive UI** — Dark glassmorphism design with micro-animations

---

## Project Structure

```
job-aggregator/
├── .github/
│   └── workflows/
│       └── ingest.yml              ← GitHub Actions scheduler (every 4h)
├── ingestion/                      ← Python ingestion service
│   ├── main.py                     ← Entry point; orchestrates all sources
│   ├── normalizer.py               ← Maps raw API responses → common schema
│   ├── deduper.py                  ← Hash-based deduplication
│   ├── upserter.py                 ← Supabase upsert (batch)
│   ├── fix_experience_levels.py    ← One-off backfill script
│   ├── requirements.txt
│   └── sources/
│       ├── arbeitnow.py            ← Free, no key required
│       ├── remoteok.py             ← Free, no key required
│       ├── adzuna.py               ← Free tier (ADZUNA_APP_ID + ADZUNA_APP_KEY)
│       ├── jooble.py               ← Free tier (JOOBLE_API_KEY)
│       ├── jsearch.py              ← Google Jobs via RapidAPI (JSEARCH_API_KEY) ← Primary
│       └── serpapi.py              ← Google Jobs via SerpAPI (opt-in, SERPAPI_ENABLED=true)
├── frontend/                       ← Next.js 16 app (React 19)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                ← Main job board UI + application tracker
│   │   ├── globals.css             ← Full design system
│   │   ├── login/
│   │   │   └── page.tsx            ← Sign-in / sign-up (email + Google OAuth)
│   │   └── preferences/
│   │       └── page.tsx            ← User preferences page
│   └── lib/
│       └── supabase.ts             ← Typed Supabase client, query helpers, auth utils
├── schema.sql                      ← Paste into Supabase SQL Editor
├── supabase_applications_table.sql ← Job applications table migration
└── README.md
```

---

## Setup

### 1. Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run `schema.sql` → then `supabase_applications_table.sql`
3. Enable **Google OAuth** in Authentication → Providers (optional)
4. Note your **Project URL** and **Anon Key** (Settings → API)

### 2. Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Ingestion (local test)
```bash
cd ingestion
pip install -r requirements.txt
cp .env.example .env   # or create .env manually
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

# JSearch via RapidAPI (200 req/month free) — https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
JSEARCH_API_KEY=your-jsearch-key

# SerpAPI (optional, 100 searches/month free) — https://serpapi.com
# Set SERPAPI_ENABLED=true to activate; disabled by default to preserve credits
SERPAPI_KEY=your-serpapi-key
SERPAPI_ENABLED=false
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
   - `JSEARCH_API_KEY`
   - `SERPAPI_KEY` *(optional)*
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
| [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) | Yes | **Naukri, LinkedIn, Indeed, Glassdoor** | 200 req/month |
| [SerpAPI](https://serpapi.com/google-jobs-api) | Yes | Google Jobs (opt-in) | 100 searches/month |

---

## Role Categories

| Category | Keywords Matched |
|---|---|
| `data-integrity` | data integrity, data quality, dq analyst, data governance |
| `data-engineer` | data engineer, etl, pipeline engineer, data platform |
| `analytics-engineer` | analytics engineer, dbt |
| `business-analyst` | business analyst, bi analyst, reporting analyst |
| `data-scientist` | data scientist, ml engineer, machine learning |
| `devops` | devops engineer, platform engineer, infrastructure, cloud engineer, SRE, site reliability |
| `data-analyst` | data analyst, analyst (catch-all) |

---

## Experience Levels

Experience levels are automatically extracted from job description text using keyword matching:

| Level | Signals |
|---|---|
| `entry` | 0–2 years, fresher, graduate, trainee, intern |
| `mid` | 2–5 years, mid-level, intermediate |
| `senior` | 5+ years, senior, lead, principal, staff, head of |

---

## Application Tracker

Logged-in users can track every job application directly from the job board:

- **Status** — Applied, Interviewing, Offer, Rejected, Ghosted
- **ATS** — Workday, Greenhouse, Lever, iCIMS, SAP, SmartRecruiters, and more
- **Resume name** — which version you sent
- **Tracking link** — your portal application URL
- **Email** — recruiter or HR contact
- **Export** — download the full tracker as an Excel (`.xlsx`) file

---

## Phase 2 (Planned)
- Gmail API integration to parse LinkedIn/Naukri job alert emails
- Company career page scrapers (static HTML only)
- AI-powered JD summarisation and skill extraction
- Dashboard analytics — application funnel, response rate by source
