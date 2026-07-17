"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJobs, type Job, type JobFilters } from "@/lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  "data-analyst":        "Data Analyst",
  "data-integrity":      "Data Integrity",
  "data-engineer":       "Data Engineer",
  "analytics-engineer":  "Analytics Engineer",
  "data-scientist":      "Data Scientist",
  "business-analyst":    "Business Analyst",
  "other":               "Other",
};

const DATE_OPTIONS = [
  { label: "Any time",    value: 0 },
  { label: "Last 24h",   value: 1 },
  { label: "Last 7 days",value: 7 },
  { label: "Last 30 days",value: 30 },
];

const EXPERIENCE_OPTIONS = [
  { label: "All Levels",  value: "" },
  { label: "🌱 Entry Level", value: "entry" },
  { label: "🔶 Mid Level",  value: "mid" },
  { label: "🚀 Senior",     value: "senior" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function companyInitial(company: string): string {
  return (company || "?")[0].toUpperCase();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="job-card" style={{ pointerEvents: "none" }}>
      <div className="card-top">
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 16, width: "70%", marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 13, width: "40%" }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 13, width: "100%", marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 13, width: "80%" }} />
    </div>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const snippet = job.jd_text
    ? job.jd_text.replace(/<[^>]+>/g, " ").slice(0, 200).trim()
    : "";

  const expLabel: Record<string, string> = { entry: "🌱 Entry", mid: "🔶 Mid", senior: "🚀 Senior" };

  return (
    <article className="job-card" onClick={onClick} tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}>
      <div className="card-top">
        <div className="card-company-initial"
          style={{
            background: `hsl(${(job.company.charCodeAt(0) * 47) % 360}, 70%, 55%) linear-gradient(135deg, transparent, rgba(0,0,0,0.2))`
          }}>
          {companyInitial(job.company)}
        </div>
        <div className="card-header">
          <h2 className="card-title">{job.title}</h2>
          <div className="card-company">{job.company}</div>
        </div>
        <span className="card-source-chip">{job.source}</span>
      </div>

      <div className="card-meta">
        {job.location && (
          <span className="card-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {job.location}
          </span>
        )}
        {job.posted_date && (
          <span className="card-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {timeAgo(job.posted_date)}
          </span>
        )}
        {job.experience_level && (
          <span className="card-meta-item" style={{ fontWeight: 600 }}>
            {expLabel[job.experience_level] ?? job.experience_level}
          </span>
        )}
      </div>

      {snippet && <p className="card-snippet">{snippet}…</p>}

      <div className="card-footer">
        <span className={`badge badge-${job.role_category}`}>
          {ROLE_LABELS[job.role_category] || job.role_category}
        </span>
        {(job.tags || []).slice(0, 4).map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>
    </article>
  );
}

function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="detail-close" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className={`badge badge-${job.role_category}`}>
            {ROLE_LABELS[job.role_category] || job.role_category}
          </span>
          <span className="card-source-chip">{job.source}</span>
          {(job.tags || []).map(tag => <span key={tag} className="tag">{tag}</span>)}
        </div>

        <h1 className="detail-title">{job.title}</h1>
        <p className="detail-company">{job.company}</p>

        <div className="detail-meta-row">
          {job.location && (
            <span className="card-meta-item" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {job.location}
            </span>
          )}
          {job.posted_date && (
            <span className="card-meta-item" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Posted {new Date(job.posted_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>

        <div className="detail-jd">
          {job.jd_text
            ? job.jd_text.replace(/<[^>]+>/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
            : "No job description available."}
        </div>

        {job.apply_url && (
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="apply-btn">
            Apply Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [searchRaw, setSearchRaw] = useState("");
  const [role, setRole] = useState("");
  const [days, setDays] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [experience, setExperience] = useState("");

  const search = useDebounce(searchRaw, 400);
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const filters: JobFilters = { page: pg };
      if (search) filters.q = search;
      if (role) filters.role = role;
      if (days) filters.days = days;
      if (locationFilter) filters.location = locationFilter;
      if (remoteOnly) filters.remote = true;
      if (experience) filters.experience = experience;
      const { jobs: data, total: count } = await fetchJobs(filters);
      setJobs(data);
      setTotal(count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, role, days, locationFilter, remoteOnly, experience]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, role, days, locationFilter, remoteOnly, experience]);  // eslint-disable-line

  useEffect(() => {
    if (page !== 1) load(page);
  }, [page]);  // eslint-disable-line

  const hasFilters = !!(search || role || days || locationFilter || remoteOnly || experience);

  function clearFilters() {
    setSearchRaw(""); setRole(""); setDays(0); setLocationFilter(""); setRemoteOnly(false); setExperience("");
  }

  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="container header-inner">
          <span className="logo">⚡ DataJobs</span>
          <span className="header-meta">
            Updated every 4 hours · {total.toLocaleString()} listings
          </span>
        </div>
      </header>

      <main className="container">
        {/* ── Hero ── */}
        <section className="hero">
          <h1>Find Your Next <span>Data Role</span></h1>
          <p>
            Curated jobs for data analysts, engineers, scientists &amp; more —
            sourced live from top job APIs, deduplicated, and updated every 4 hours.
          </p>
          <div className="search-wrap">
            <input
              id="search-input"
              type="search"
              className="search-input"
              placeholder="Search by title, skill, or keyword…"
              value={searchRaw}
              onChange={e => setSearchRaw(e.target.value)}
              aria-label="Search jobs"
            />
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className="stats-bar">
          <span><strong>{total.toLocaleString()}</strong> active listings</span>
          {!loading && jobs.length > 0 && (
            <span>Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong></span>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="filter-row">
          <select id="role-filter" className="filter-select" value={role}
            onChange={e => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select id="experience-filter" className="filter-select" value={experience}
            onChange={e => setExperience(e.target.value)} aria-label="Filter by experience level">
            {EXPERIENCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select id="date-filter" className="filter-select" value={days}
            onChange={e => setDays(Number(e.target.value))} aria-label="Filter by date">
            {DATE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input
            id="location-filter"
            type="text"
            className="filter-select"
            placeholder="Location…"
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            style={{ width: 140 }}
            aria-label="Filter by location"
          />

          <button
            id="remote-toggle"
            className={`filter-toggle ${remoteOnly ? "active" : ""}`}
            onClick={() => setRemoteOnly(v => !v)}
          >
            🌍 Remote only
          </button>

          {hasFilters && (
            <button id="clear-filters" className="filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {/* ── Job Grid ── */}
        {loading ? (
          <div className="job-grid">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <h3>No jobs found</h3>
            <p>Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="job-grid">
            {jobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJob(job)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button id="prev-page" className="page-btn"
              disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              ‹
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 7) {
                if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
              }
              return (
                <button key={p} id={`page-${p}`}
                  className={`page-btn ${page === p ? "active" : ""}`}
                  onClick={() => setPage(p)}>
                  {p}
                </button>
              );
            })}
            <button id="next-page" className="page-btn"
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              ›
            </button>
          </nav>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          ⚡ DataJobs · Sources: Adzuna, Arbeitnow, RemoteOK ·{" "}
          <span style={{ color: "var(--text-muted)" }}>Updated every 4 hours</span>
        </div>
      </footer>

      {/* ── Job Detail Overlay ── */}
      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </>
  );
}
