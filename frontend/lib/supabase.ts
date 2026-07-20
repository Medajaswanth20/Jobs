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
  country?: string;      // precise country filter — uses ', Country' pattern
  remote?: boolean;
  experience?: string;
  page?: number;
};

const PAGE_SIZE = 20;

/**
 * Location keywords for each country chip.
 * Includes the country name itself PLUS all states/territories/major cities
 * that appear in job location strings WITHOUT explicitly mentioning the country.
 * e.g. "Ahmedabad, Gujarat" → matches India via "Gujarat"
 */
const COUNTRY_LOCATION_TERMS: Record<string, string[]> = {
  "India": [
    "India",
    // States & Union Territories
    "Gujarat", "Maharashtra", "Karnataka", "Tamil Nadu", "Telangana",
    "Uttar Pradesh", "West Bengal", "Rajasthan", "Haryana", "Punjab",
    "Madhya Pradesh", "Kerala", "Andhra Pradesh", "Bihar", "Odisha",
    "Jharkhand", "Uttarakhand", "Assam", "Himachal Pradesh", "Goa",
    "Chhattisgarh", "Tripura", "Manipur", "Meghalaya", "Nagaland",
    // Major cities often listed without state
    "Delhi", "Mumbai", "Bangalore", "Bengaluru", "Chennai", "Hyderabad",
    "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Noida", "Gurugram",
    "Gurgaon", "Chandigarh", "Kochi", "Indore", "Bhopal", "Nagpur",
    "Visakhapatnam", "Surat", "Vadodara", "Coimbatore", "Lucknow",
    "Navi Mumbai", "Thane", "Mysuru", "Mysore", "Trivandrum",
  ],
  "United States": ["United States", "USA"],
  "United Kingdom": ["United Kingdom", "England", "Scotland", "Wales"],
  "Australia":      ["Australia"],
  "Canada":         ["Canada"],
  "Germany":        ["Germany"],
  "Singapore":      ["Singapore"],
  "UAE":            ["UAE", "Dubai", "Abu Dhabi", "Sharjah"],
  "Netherlands":    ["Netherlands", "Holland"],
  "remote":         ["Remote"],
};

/** Build a PostgREST .or() string for a country — comma-free patterns only */
function buildCountryOrFilter(country: string): string {
  const terms = COUNTRY_LOCATION_TERMS[country] ?? [country];
  const parts: string[] = [];
  for (const term of terms) {
    parts.push(`location.ilike.${term}`);    // exact: "Gujarat"
    parts.push(`location.ilike.% ${term}`);  // ends: "Ahmedabad, Gujarat"
    parts.push(`location.ilike.${term} %`);  // starts: "Gujarat Remote"
  }
  return parts.join(",");
}


export async function fetchJobs(filters: JobFilters = {}): Promise<{ jobs: Job[]; total: number }> {
  const supabase = getSupabase();
  const { q, role, days, location, country, remote, experience, page = 1 } = filters;
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
  if (country) {
    query = query.or(buildCountryOrFilter(country));
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

// ── Job Applications ─────────────────────────────────────────────────────────

export type JobApplication = {
  id?: string;
  job_id: string;
  company: string;
  role: string;
  tracking_link?: string;
  applied_date: string;   // stored as YYYY-MM-DD in DB, displayed as DD/MM/YY
  resume_name?: string;
  status?: string;
  email?: string;
  ats?: string;
  created_at?: string;
};

/** Convert ISO date (YYYY-MM-DD) → display format DD/MM/YY */
export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export async function saveApplication(app: Omit<JobApplication, "id" | "created_at">): Promise<JobApplication | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("job_applications")
    .insert([app])
    .select()
    .single();
  if (error) {
    console.error("saveApplication error — code:", error.code, "| message:", error.message, "| details:", error.details, "| hint:", error.hint);
    return null;
  }
  return data as JobApplication;
}

export async function fetchApplications(): Promise<JobApplication[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchApplications error:", error); return []; }
  return (data as JobApplication[]) || [];
}

export async function updateApplication(id: string, updates: Partial<JobApplication>): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("job_applications").update(updates).eq("id", id);
}

export async function deleteApplication(id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("job_applications").delete().eq("id", id);
}
