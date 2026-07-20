"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJobs, type Job, type JobFilters, type JobApplication, saveApplication, fetchApplications, updateApplication, deleteApplication, isoToDisplay, getUser, onAuthChange, getUserPreferences, signOut } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  "data-analyst":        "Data Analyst",
  "data-integrity":      "Data Integrity",
  "data-engineer":       "Data Engineer",
  "analytics-engineer":  "Analytics Engineer",
  "data-scientist":      "Data Scientist",
  "business-analyst":    "Business Analyst",
  "devops":              "DevOps / SRE",
  "cloud-engineer":      "Cloud Engineer",
  "other":               "Other",
};

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  serpapi:   { label: "SerpApi",   icon: "🔍" },
  linkedin:  { label: "LinkedIn",  icon: "💼" },
  jsearch:   { label: "JSearch",   icon: "⚡" },
  adzuna:    { label: "Adzuna",    icon: "🌐" },
  arbeitnow: { label: "Arbeitnow", icon: "📋" },
  remoteok:  { label: "RemoteOK",  icon: "🏠" },
  jooble:    { label: "Jooble",    icon: "🔎" },
};

const PORTAL_HOST_MAP: [RegExp, { label: string; icon: string }][] = [
  [/linkedin/,            { label: "LinkedIn",  icon: "💼" }],
  [/naukri/,              { label: "Naukri",    icon: "🇮🇳" }],
  [/foundit|monster/,     { label: "Foundit",   icon: "🎯" }],
  [/indeed/,              { label: "Indeed",    icon: "🔵" }],
  [/glassdoor/,           { label: "Glassdoor", icon: "🪟" }],
  [/shine\.com/,          { label: "Shine",     icon: "✨" }],
  [/iimjobs/,             { label: "IIMJobs",   icon: "🎓" }],
  [/instahyre/,           { label: "Instahyre", icon: "⚡" }],
  [/internshala/,         { label: "Internshala",icon: "🎒" }],
  [/cutshort/,            { label: "Cutshort",  icon: "✂️" }],
  [/wellfound|angel/,     { label: "Wellfound", icon: "👼" }],
  [/ziprecruiter/,        { label: "ZipRecruiter",icon:"📮" }],
  [/simplyhired/,         { label: "SimplyHired",icon:"📄" }],
  [/jobsdb/,              { label: "JobsDB",    icon: "🗄️" }],
  [/workday/,             { label: "Workday",   icon: "🏢" }],
  [/lever\.co/,           { label: "Lever",     icon: "🔧" }],
  [/greenhouse/,          { label: "Greenhouse",icon: "🌿" }],
  [/smartrecruiters/,     { label: "SmartRecruit",icon:"🤝" }],
];

const STATUS_OPTIONS = ["Applied", "Review", "Interview", "Rejected", "Offer"];

function getPortalFromUrl(url: string): { label: string; icon: string } | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [pattern, meta] of PORTAL_HOST_MAP) {
      if (pattern.test(host)) return meta;
    }
  } catch { /* invalid URL */ }
  return null;
}

function SourceChip({ source, applyUrl }: { source: string; applyUrl?: string }) {
  const key = (source || "").toLowerCase();
  const isAggregator = ["serpapi", "jsearch"].includes(key);
  const portalFromUrl = isAggregator ? getPortalFromUrl(applyUrl || "") : null;
  const meta = portalFromUrl ?? SOURCE_META[key];
  return (
    <span className="card-source-chip" data-source={portalFromUrl ? portalFromUrl.label.toLowerCase() : key}>
      {meta ? `${meta.icon} ${meta.label}` : source}
    </span>
  );
}

const DATE_OPTIONS = [
  { label: "Any time",    value: 0 },
  { label: "Last 24h",   value: 1 },
  { label: "Last 7 days",value: 7 },
  { label: "Last 30 days",value: 30 },
];

const EXPERIENCE_OPTIONS = [
  { label: "All Levels",          value: "" },
  { label: "🌱 Entry (0–2 yrs)",  value: "entry" },
  { label: "🔶 Mid (2–5 yrs)",    value: "mid" },
  { label: "🚀 Senior (5+ yrs)",  value: "senior" },
];

const COUNTRY_CHIPS = [
  { flag: "🇮🇳", label: "India",         value: "India" },
  { flag: "🇺🇸", label: "USA",           value: "United States" },
  { flag: "🇬🇧", label: "UK",            value: "United Kingdom" },
  { flag: "🇦🇺", label: "Australia",     value: "Australia" },
  { flag: "🇨🇦", label: "Canada",        value: "Canada" },
  { flag: "🇩🇪", label: "Germany",       value: "Germany" },
  { flag: "🇸🇬", label: "Singapore",     value: "Singapore" },
  { flag: "🇦🇪", label: "UAE",           value: "UAE" },
  { flag: "🇳🇱", label: "Netherlands",   value: "Netherlands" },
  { flag: "🇷🇪", label: "Remote",        value: "remote" },
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

function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD for Supabase
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
      <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
      <div className="card-body" style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 16, width: "65%", marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: "40%", marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 13, width: "100%", marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 13, width: "80%" }} />
      </div>
    </div>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const snippet = job.jd_text
    ? job.jd_text.replace(/<[^>]+>/g, " ").slice(0, 220).trim()
    : "";

  const expLabel: Record<string, string> = {
    entry:  "🌱 Entry · 0–2 yrs",
    mid:    "🔶 Mid · 2–5 yrs",
    senior: "🚀 Senior · 5+ yrs",
  };

  const avatarHue = (job.company.charCodeAt(0) * 47) % 360;

  return (
    <article className="job-card" onClick={onClick} tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}>

      {/* Company Avatar */}
      <div className="card-company-initial"
        style={{ background: `hsl(${avatarHue}, 65%, 52%)` }}>
        {companyInitial(job.company)}
      </div>

      {/* Card Body */}
      <div className="card-body">
        <div className="card-top">
          <div className="card-header">
            <h2 className="card-title">{job.title}</h2>
          </div>
          <SourceChip source={job.source} applyUrl={job.apply_url} />
        </div>

        {/* Meta row */}
        <div className="card-meta-row">
          <span className="card-company">{job.company}</span>
          {job.location && (
            <>
              <span className="card-sep">·</span>
              <span className="card-meta-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {job.location}
              </span>
            </>
          )}
          {job.posted_date && (
            <>
              <span className="card-sep">·</span>
              <span className="card-meta-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {timeAgo(job.posted_date)}
              </span>
            </>
          )}
          {job.experience_level && (
            <>
              <span className="card-sep">·</span>
              <span className="exp-badge">{expLabel[job.experience_level] ?? job.experience_level}</span>
            </>
          )}
        </div>

        {snippet && <p className="card-snippet">{snippet}…</p>}

        {/* Footer: tags + apply button */}
        <div className="card-footer">
          <div className="card-tags">
            <span className={`badge badge-${job.role_category}`}>
              {ROLE_LABELS[job.role_category] || job.role_category}
            </span>
            {(job.tags || []).slice(0, 4).map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-btn-card"
              onClick={e => e.stopPropagation()}
            >
              Apply now
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Job Detail with Resume Upload & Apply Tracking ────────────────────────────

function JobDetail({
  job,
  onClose,
  onApplied,
}: {
  job: Job;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [resumeName, setResumeName] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setResumeName(file.name);
  }

  async function handleMarkApplied() {
    setApplying(true);
    setApplyError("");
    const today = formatDateISO(new Date());
    const roleLabel = ROLE_LABELS[job.role_category] || job.role_category;
    const currentUser = await getUser();
    const result = await saveApplication({
      job_id: job.id,
      company: job.company,
      role: roleLabel,
      tracking_link: job.apply_url || "",
      applied_date: today,
      resume_name: resumeName || "",
      status: "Applied",
      email: "",
      ats: "",
      ...(currentUser ? { user_id: currentUser.id } : {}),
    });
    setApplying(false);
    if (result) {
      setApplied(true);
      onApplied();
    } else {
      setApplyError("Failed to save. Check Supabase table exists.");
    }
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="detail-close" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className={`badge badge-${job.role_category}`}>
            {ROLE_LABELS[job.role_category] || job.role_category}
          </span>
          <SourceChip source={job.source} applyUrl={job.apply_url} />
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

        {/* ── Resume Upload + Apply Section ── */}
        <div className="apply-section">
          <div className="resume-upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: "none" }}
              onChange={handleFileChange}
              id="resume-file-input"
            />
            <button
              className="resume-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {resumeName ? "Change Resume" : "Upload Resume"}
            </button>
            {resumeName && (
              <span className="resume-name-pill">
                📄 {resumeName}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {job.apply_url && (
              <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="apply-btn">
                Apply Now
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}

            {applied ? (
              <span className="applied-badge">✅ Saved to Tracker!</span>
            ) : (
              <button
                className="mark-applied-btn"
                onClick={handleMarkApplied}
                disabled={applying}
                type="button"
              >
                {applying ? (
                  <>
                    <span className="btn-spinner" />
                    Saving…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Mark as Applied
                  </>
                )}
              </button>
            )}
          </div>
          {applyError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{applyError}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Applications Tracker Modal ────────────────────────────────────────────────

function ApplicationsModal({ onClose }: { onClose: () => void }) {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    getUser().then(u => {
      fetchApplications(u?.id).then(data => { setApps(data); setLoading(false); });
    });
  }, []);

  async function handleCellEdit(id: string, field: keyof JobApplication, value: string) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    await updateApplication(id, { [field]: value });
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this entry from the tracker?")) return;
    await deleteApplication(id);
    setApps(prev => prev.filter(a => a.id !== id));
  }

  function downloadExcel() {
    const rows = apps.map(a => ({
      Company:        a.company,
      "Tracking link": a.tracking_link || "",
      Role:           a.role,
      "Applied date": isoToDisplay(a.applied_date),
      ID:             a.job_id,
      Resume:         a.resume_name || "",
      Status:         a.status || "",
      Email:          a.email || "",
      ATS:            a.ats || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws["!cols"] = [
      { wch: 22 }, { wch: 35 }, { wch: 20 }, { wch: 14 },
      { wch: 14 }, { wch: 38 }, { wch: 12 }, { wch: 26 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Job Applications");
    XLSX.writeFile(wb, `Job_Applications_${isoToDisplay(new Date().toISOString().split("T")[0]).replace(/\//g, "-")}.xlsx`);

  }

  return (
    <div className="tracker-overlay" onClick={onClose}>
      <div className="tracker-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="tracker-header">
          <div>
            <h2 className="tracker-title">📋 My Applications</h2>
            <p className="tracker-subtitle">
              {apps.length} application{apps.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <button className="tracker-close-btn" style={{ width: 34, height: 34, borderRadius: "50%", padding: 0 }} onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Table */}
        <div className="tracker-table-wrap">
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
              Loading…
            </div>
          ) : apps.length === 0 ? (
            <div className="tracker-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="2" ry="2"/>
              </svg>
              <p>No applications yet. Click <strong>Mark as Applied</strong> on any job to start tracking!</p>
            </div>
          ) : (
            <table className="tracker-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Tracking Link</th>
                  <th>Role</th>
                  <th>Applied Date</th>
                  <th>ID</th>
                  <th>Resume</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>ATS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.map(app => (
                  <tr key={app.id}>
                    <td className="td-company">{app.company}</td>
                    <td className="td-link">
                      {app.tracking_link ? (
                        <a href={app.tracking_link} target="_blank" rel="noopener noreferrer" className="tracker-link">
                          🔗 Link
                        </a>
                      ) : "—"}
                    </td>
                    <td>{app.role}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{isoToDisplay(app.applied_date)}</td>
                    <td className="td-id" style={{ fontFamily: "monospace", fontSize: 11 }}>{app.job_id}</td>
                    <td className="td-resume" style={{ fontStyle: "italic" }}>{app.resume_name || "—"}</td>
                    <td>
                      <select
                        className="tracker-status-select"
                        value={app.status || "Applied"}
                        data-status={(app.status || "applied").toLowerCase()}
                        onChange={e => handleCellEdit(app.id!, "status", e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="tracker-cell-input"
                        value={app.email || ""}
                        placeholder="email received"
                        onChange={e => handleCellEdit(app.id!, "email", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="tracker-cell-input"
                        value={app.ats || ""}
                        placeholder="ATS used"
                        onChange={e => handleCellEdit(app.id!, "ats", e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        className="tracker-delete-btn"
                        onClick={() => handleDelete(app.id!)}
                        title="Remove entry"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div className="tracker-footer">
          <button className="tracker-close-btn" onClick={onClose}>Close</button>
          <button className="tracker-download-btn" onClick={downloadExcel} disabled={apps.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Excel
          </button>
        </div>
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
  const [showTracker, setShowTracker] = useState(false);
  const [appCount, setAppCount] = useState(0);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [searchRaw, setSearchRaw] = useState("");
  const [role, setRole] = useState("");
  const [days, setDays] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [experience, setExperience] = useState("");

  const search = useDebounce(searchRaw, 400);
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Auth listener — fires on mount and whenever auth state changes
  useEffect(() => {
    getUser().then(async u => {
      setUser(u);
      if (u) {
        const prefs = await getUserPreferences(u.id);
        if (prefs) {
          if (prefs.preferred_role)       setRole(prefs.preferred_role);
          if (prefs.preferred_country)    setCountryFilter(prefs.preferred_country);
          if (prefs.preferred_experience) setExperience(prefs.preferred_experience);
          if (prefs.remote_only)          setRemoteOnly(prefs.remote_only);
        }
        fetchApplications(u.id).then(data => setAppCount(data.length));
      } else {
        fetchApplications().then(data => setAppCount(data.length));
      }
    });
    const sub = onAuthChange(async u => {
      setUser(u);
      if (u) {
        const prefs = await getUserPreferences(u.id);
        if (prefs) {
          if (prefs.preferred_role)       setRole(prefs.preferred_role);
          if (prefs.preferred_country)    setCountryFilter(prefs.preferred_country);
          if (prefs.preferred_experience) setExperience(prefs.preferred_experience);
          if (prefs.remote_only)          setRemoteOnly(prefs.remote_only);
        }
        fetchApplications(u.id).then(data => setAppCount(data.length));
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const filters: JobFilters = { page: pg };
      if (search) filters.q = search;
      if (role) filters.role = role;
      if (days) filters.days = days;
      if (locationFilter) filters.location = locationFilter;
      if (countryFilter) filters.country = countryFilter;
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
  }, [search, role, days, locationFilter, countryFilter, remoteOnly, experience]);


  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, role, days, locationFilter, countryFilter, remoteOnly, experience]);  // eslint-disable-line


  useEffect(() => {
    if (page !== 1) load(page);
  }, [page]);  // eslint-disable-line

  const hasFilters = !!(search || role || days || locationFilter || countryFilter || remoteOnly || experience);


  function clearFilters() {
    setSearchRaw(""); setRole(""); setDays(0); setLocationFilter(""); setCountryFilter(""); setRemoteOnly(false); setExperience("");
  }


  function handleApplied() {
    setAppCount(c => c + 1);
  }

  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="container header-inner">
          <div className="header-left">
            <span className="logo">
              <img src="/logo.png" alt="Job Hub Logo" style={{ height: 36, width: 36, borderRadius: 8, objectFit: "cover" }} />
              Job Hub
            </span>
            <nav className="header-nav">
              <span className="nav-link active">Find Jobs</span>
              <button
                id="open-tracker-btn"
                className="nav-link-btn"
                onClick={() => setShowTracker(true)}
              >
                My Applications
                {appCount > 0 && <span className="tracker-badge-dot">{appCount}</span>}
              </button>
            </nav>
          </div>
          <div className="header-right">
            <span className="header-meta" style={{ display: "none" }}>{total.toLocaleString()} active listings · updated every 4h</span>
            {user ? (
              <div className="user-menu">
                <button
                  id="user-avatar-btn"
                  className="user-avatar-btn"
                  onClick={() => setUserMenuOpen(o => !o)}
                  aria-label="User menu"
                >
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </button>
                {userMenuOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-email">{user.email}</div>
                    <a href="/preferences" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                      ⚙️ Preferences
                    </a>
                    <button
                      className="user-dropdown-item danger"
                      onClick={async () => { await signOut(); setUser(null); setUserMenuOpen(false); }}
                    >
                      🚪 Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a href="/login" className="login-header-btn" id="header-login-btn">
                Sign In
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero (full-width gradient) ── */}
      <section className="hero-section">
        <div className="hero-inner">
          <h1>Find Your Next <br />Data &amp; DevOps Role</h1>
          <p>Curated jobs for data analysts, engineers, scientists, and DevOps — sourced live, deduplicated &amp; updated every 4 hours.</p>
          <div className="hero-search">
            <span className="hero-search-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <input
              id="search-input"
              type="search"
              className="search-input"
              placeholder="Search by title, skill, or keyword…"
              value={searchRaw}
              onChange={e => setSearchRaw(e.target.value)}
              aria-label="Search jobs"
            />
            <button className="hero-search-btn">Search</button>
          </div>
        </div>
      </section>

      {/* ── Two-column page body ── */}
      <div className="page-body">

        {/* ── Jobs column ── */}
        <div className="jobs-col">

          {/* Results bar */}
          <div className="results-bar">
            <span className="results-count">
              Showing results <strong>({total.toLocaleString()})</strong>
              {!loading && jobs.length > 0 && (
                <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
                  · page {page} of {totalPages}
                </span>
              )}
            </span>
          </div>

          {/* Country chips */}
          <div className="country-chips-row">
            <span className="country-chips-label">Country:</span>
            {COUNTRY_CHIPS.map(c => (
              <button
                key={c.value}
                id={`country-${c.value.toLowerCase().replace(/\s+/g, "-")}`}
                className={`country-chip ${countryFilter === c.value ? "active" : ""}`}
                onClick={() => {
                  const next = countryFilter === c.value ? "" : c.value;
                  setCountryFilter(next);
                }}
              >
                <span className="chip-flag">{c.flag}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Job list */}
          {loading ? (
            <div className="job-list">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
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
            <div className="job-list">
              {(user ? jobs : jobs.slice(0, 5)).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJob(job)}
                />
              ))}
              {/* Gated wall for non-logged-in users */}
              {!user && jobs.length > 5 && (
                <div className="gated-wall">
                  <div className="gated-wall-blur" />
                  <div className="gated-cta">
                    <h3>🔒 {total.toLocaleString()} jobs available</h3>
                    <p>
                      You&apos;re seeing 5 of {total.toLocaleString()} matched jobs.<br />
                      Sign in to see all results and get personalized recommendations.
                    </p>
                    <div className="gated-cta-btns">
                      <a href="/login" className="gated-login-btn" id="gated-login-btn">Sign In</a>
                      <a href="/login" className="gated-signup-btn" id="gated-signup-btn">Create Free Account</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button id="prev-page" className="page-btn"
                disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
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
                    onClick={() => setPage(p)}>{p}</button>
                );
              })}
              <button id="next-page" className="page-btn"
                disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </nav>
          )}
        </div>

        {/* ── Filter Sidebar ── */}
        <aside className="filter-sidebar">
          <div className="filter-panel">
            <div className="filter-panel-header">
              <span className="filter-panel-title">Filter</span>
              {hasFilters && (
                <button className="filter-reset" onClick={clearFilters}>Reset</button>
              )}
            </div>

            <div className="filter-group">
              <label className="filter-group-label">Role</label>
              <select id="role-filter" className="filter-select" value={role}
                onChange={e => setRole(e.target.value)} aria-label="Filter by role">
                <option value="">All Roles</option>
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-group-label">Experience level</label>
              <select id="experience-filter" className="filter-select" value={experience}
                onChange={e => setExperience(e.target.value)} aria-label="Filter by experience level">
                {EXPERIENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-group-label">Date posted</label>
              <select id="date-filter" className="filter-select" value={days}
                onChange={e => setDays(Number(e.target.value))} aria-label="Filter by date">
                {DATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-group-label">Location</label>
              <input
                id="location-filter"
                type="text"
                className="filter-location-input"
                placeholder="City, state or country…"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                aria-label="Filter by location"
              />
            </div>

            <div className="filter-group">
              <label className="filter-group-label">Job type</label>
              <button
                id="remote-toggle"
                className={`filter-toggle ${remoteOnly ? "active" : ""}`}
                onClick={() => setRemoteOnly(v => !v)}
              >
                🌍 Remote only
              </button>
            </div>
          </div>
        </aside>

      </div>{/* end page-body */}

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          ⚡ Job Hub · Sources: Adzuna, Arbeitnow, RemoteOK, Jooble, SerpAPI ·{" "}
          <span style={{ color: "var(--text-muted)" }}>Updated every 4 hours</span>
        </div>
      </footer>

      {/* ── Job Detail Overlay ── */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApplied={handleApplied}
        />
      )}

      {/* ── Applications Tracker Modal ── */}
      {showTracker && (
        <ApplicationsModal onClose={() => setShowTracker(false)} />
      )}
    </>
  );
}
