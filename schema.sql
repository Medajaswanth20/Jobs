-- =============================================================
-- Job Aggregator — Supabase Schema
-- Paste this into Supabase SQL Editor and run it.
-- =============================================================

-- 1. Jobs table
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  company       text not null,
  location      text,
  jd_text       text,
  posted_date   timestamptz,
  source        text,           -- 'adzuna' | 'arbeitnow' | 'remoteok' | 'email'
  apply_url     text,
  tags          text[],         -- ['remote','sql','python',...]
  role_category text,           -- 'data-analyst' | 'data-integrity' | 'data-engineer' | etc.
  experience_level text,        -- 'entry' | 'mid' | 'senior' | NULL
  source_id     text,           -- original ID from source API
  hash          text unique not null,  -- sha256(company+title+location) for dedup
  is_active     boolean default true,
  created_at    timestamptz default now(),
  search_vector tsvector        -- populated by trigger below
);

-- 2. Indexes for performance
create index if not exists jobs_posted_date_idx      on jobs (posted_date desc);
create index if not exists jobs_role_category_idx    on jobs (role_category);
create index if not exists jobs_experience_level_idx on jobs (experience_level);
create index if not exists jobs_is_active_idx        on jobs (is_active);
create index if not exists jobs_source_idx           on jobs (source);
create index if not exists jobs_search_gin_idx       on jobs using gin(search_vector);
create index if not exists jobs_tags_gin_idx      on jobs using gin(tags);

-- 3. Auto-update full-text search vector on insert/update
create or replace function update_search_vector()
returns trigger as $$
begin
  new.search_vector := to_tsvector(
    'english',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.company, '') || ' ' ||
    coalesce(new.location, '') || ' ' ||
    coalesce(new.jd_text, '')
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_search_trigger on jobs;
create trigger jobs_search_trigger
before insert or update on jobs
for each row execute function update_search_vector();

-- 4. Function to expire old jobs (called by ingestion script after each run)
create or replace function expire_old_jobs()
returns void as $$
  update jobs
  set is_active = false
  where is_active = true
    and posted_date < now() - interval '30 days';
$$ language sql;

-- 5. Enable Row Level Security (read-only for anon users)
alter table jobs enable row level security;

-- Allow anyone to read active jobs (needed for frontend with anon key)
create policy "Public read active jobs"
  on jobs for select
  using (is_active = true);

-- Only service role can insert/update (used by ingestion script)
-- (Service key bypasses RLS by default — no extra policy needed)

-- 6. Helpful view: recent jobs with snippet
create or replace view recent_jobs as
  select
    id, title, company, location, role_category, tags, source,
    apply_url, posted_date, is_active,
    left(jd_text, 300) as jd_snippet,
    created_at
  from jobs
  where is_active = true
  order by posted_date desc;
