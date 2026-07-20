-- ============================================================
-- Fix incorrectly classified experience_level values in jobs table
-- Run this in Supabase SQL Editor — safe to run multiple times
-- ============================================================

-- 1. Fix jobs where title contains senior/lead/principal/director/head
--    but experience_level is incorrectly set to 'entry' or 'mid'
UPDATE public.jobs
SET experience_level = 'senior'
WHERE is_active = true
  AND experience_level IN ('entry', 'mid')
  AND (
    title ILIKE '%senior%'
    OR title ILIKE '% sr.%'
    OR title ILIKE '% sr %'
    OR title ILIKE '%[hiring] sr%'
    OR title ILIKE '%lead%'
    OR title ILIKE '%principal%'
    OR title ILIKE '%director%'
    OR title ILIKE '%head of%'
    OR title ILIKE '%staff %'
  );

-- 2. Fix jobs where title contains junior/fresher/entry but classified as senior
UPDATE public.jobs
SET experience_level = 'entry'
WHERE is_active = true
  AND experience_level = 'senior'
  AND (
    title ILIKE '%junior%'
    OR title ILIKE '% jr.%'
    OR title ILIKE '%fresher%'
    OR title ILIKE '%entry level%'
    OR title ILIKE '%entry-level%'
    OR title ILIKE '%graduate%'
  )
  -- But NOT if title also has a senior signal
  AND title NOT ILIKE '%senior%'
  AND title NOT ILIKE '% sr.%'
  AND title NOT ILIKE '%lead%'
  AND title NOT ILIKE '%principal%';

-- 3. Show a summary of the distribution after the fix
SELECT experience_level, COUNT(*) as count
FROM public.jobs
WHERE is_active = true
GROUP BY experience_level
ORDER BY count DESC;
