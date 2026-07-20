"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getUser,
  getUserPreferences,
  saveUserPreferences,
  signOut,
  type UserPreferences,
} from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import "../../app/globals.css";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "data-analyst", label: "Data Analyst" },
  { value: "data-integrity", label: "Data Integrity" },
  { value: "data-engineer", label: "Data Engineer" },
  { value: "analytics-engineer", label: "Analytics Engineer" },
  { value: "data-scientist", label: "Data Scientist" },
  { value: "business-analyst", label: "Business Analyst" },
  { value: "devops", label: "DevOps / SRE" },
  { value: "cloud-engineer", label: "Cloud Engineer" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "Any Country" },
  { value: "India", label: "🇮🇳 India" },
  { value: "United States", label: "🇺🇸 USA" },
  { value: "United Kingdom", label: "🇬🇧 UK" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "Canada", label: "🇨🇦 Canada" },
  { value: "Germany", label: "🇩🇪 Germany" },
  { value: "Singapore", label: "🇸🇬 Singapore" },
  { value: "UAE", label: "🇦🇪 UAE" },
  { value: "Netherlands", label: "🇳🇱 Netherlands" },
  { value: "remote", label: "🌐 Remote" },
];

const EXPERIENCE_OPTIONS = [
  { value: "", label: "Any Level" },
  { value: "entry", label: "🌱 Entry (0–2 yrs)" },
  { value: "mid", label: "🔶 Mid (2–5 yrs)" },
  { value: "senior", label: "🚀 Senior (5+ yrs)" },
];

export default function PreferencesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>({
    preferred_role: "",
    preferred_country: "",
    preferred_experience: "",
    remote_only: false,
  });

  useEffect(() => {
    getUser().then(async u => {
      if (!u) { router.push("/login"); return; }
      setUser(u);
      const existing = await getUserPreferences(u.id);
      if (existing) setPrefs(existing);
      setLoading(false);
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    await saveUserPreferences(user.id, prefs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push("/"), 1200);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center", padding: "48px" }}>
          <div className="btn-spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
          <p style={{ color: "var(--text-muted)" }}>Loading preferences…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="login-logo">
          <img src="/logo.png" alt="Job Hub" className="login-logo-img" />
          <span className="login-logo-text">Job Hub</span>
        </div>

        <h1 className="login-title">My Preferences</h1>
        <p className="login-sub">
          These settings will auto-apply filters when you log in.
        </p>

        <div className="prefs-user-row">
          <div className="prefs-avatar">{user?.email?.[0]?.toUpperCase() ?? "U"}</div>
          <div>
            <div className="prefs-email">{user?.email}</div>
            <button className="prefs-signout-link" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <form onSubmit={handleSave} className="login-form">
          <div className="login-field">
            <label>Preferred Role</label>
            <select
              value={prefs.preferred_role}
              onChange={e => setPrefs(p => ({ ...p, preferred_role: e.target.value }))}
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="login-field">
            <label>Preferred Country</label>
            <select
              value={prefs.preferred_country}
              onChange={e => setPrefs(p => ({ ...p, preferred_country: e.target.value }))}
            >
              {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="login-field">
            <label>Experience Level</label>
            <select
              value={prefs.preferred_experience}
              onChange={e => setPrefs(p => ({ ...p, preferred_experience: e.target.value }))}
            >
              {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="prefs-toggle-row">
            <label className="prefs-toggle-label">
              <input
                type="checkbox"
                checked={prefs.remote_only}
                onChange={e => setPrefs(p => ({ ...p, remote_only: e.target.checked }))}
              />
              <span>Show remote jobs only</span>
            </label>
          </div>

          <button type="submit" className="login-submit-btn" disabled={saving} id="save-prefs-btn">
            {saving ? <span className="btn-spinner" /> : null}
            {saved ? "✓ Saved! Redirecting…" : "Save Preferences"}
          </button>
        </form>

        <p className="login-back">
          <a href="/">← Back to Job Feed</a>
        </p>
      </div>
    </div>
  );
}
