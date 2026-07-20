-- Run this in your Supabase SQL Editor to create the job_applications table
-- (Run the full block — it's safe to re-run)

CREATE TABLE IF NOT EXISTS public.job_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        text NOT NULL,
  company       text NOT NULL,
  role          text NOT NULL,
  tracking_link text,
  applied_date  text,          -- stored as YYYY-MM-DD, displayed as DD/MM/YY
  resume_name   text,
  status        text DEFAULT 'Applied',
  email         text,
  ats           text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ⚠️  IMPORTANT: Disable RLS so the anon key can insert/select/update/delete
--     (For a personal tracker this is fine; for multi-user apps add policies instead)
ALTER TABLE public.job_applications DISABLE ROW LEVEL SECURITY;

-- Grant full access to the anon role used by the browser client
GRANT ALL ON public.job_applications TO anon;
GRANT ALL ON public.job_applications TO authenticated;
