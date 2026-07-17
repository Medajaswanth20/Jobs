import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — avoids crashing at build time when env vars are absent
let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars. Copy .env.local.example → .env.local and fill in the values.");
    _client = createClient(url, key);
  }
  return _client;
}

export const supabase = { get client() { return getSupabase(); } };

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  jd_text: string;
  jd_snippet?: string;
  posted_date: string;
  source: string;
  apply_url: string;
  tags: string[];
  role_category: string;
  experience_level: string | null;
  is_active: boolean;
  created_at: string;
};

export type JobFilters = {
  q?: string;
  role?: string;
  days?: number;
  location?: string;
  remote?: boolean;
  experience?: string;
  page?: number;
};

const PAGE_SIZE = 20;

export async function fetchJobs(filters: JobFilters = {}): Promise<{ jobs: Job[]; total: number }> {
  const supabase = getSupabase();
  const { q, role, days, location, remote, experience, page = 1 } = filters;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("jobs")
    .select("id,title,company,location,role_category,tags,source,apply_url,posted_date,is_active,created_at,jd_text,experience_level", { count: "exact" })
    .eq("is_active", true)
    .order("posted_date", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch" });
  }
  if (role) {
    query = query.eq("role_category", role);
  }
  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    query = query.gte("posted_date", since);
  }
  if (location) {
    query = query.ilike("location", `%${location}%`);
  }
  if (remote) {
    query = query.contains("tags", ["remote"]);
  }
  if (experience) {
    query = query.eq("experience_level", experience);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { jobs: (data as Job[]) || [], total: count || 0 };
}


export async function fetchJob(id: string): Promise<Job | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Job;
}
