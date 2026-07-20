"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from "@/lib/supabase";
import "../../app/globals.css";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    if (mode === "signin") {
      const { user, error } = await signInWithEmail(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (user) router.push("/");
    } else {
      const { user, error } = await signUpWithEmail(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (user) {
        setSuccess("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      }
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error } = await signInWithGoogle();
    if (error) { setError(error.message); setGoogleLoading(false); }
    // redirect handled automatically by Supabase OAuth
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <img src="/logo.png" alt="Job Hub" className="login-logo-img" />
          <span className="login-logo-text">Job Hub</span>
        </div>

        <h1 className="login-title">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="login-sub">
          {mode === "signin"
            ? "Sign in to see personalized job recommendations."
            : "Sign up to unlock your full personalized job feed."}
        </p>

        {/* Google OAuth */}
        <button
          className="google-btn"
          onClick={handleGoogle}
          disabled={googleLoading}
          type="button"
          id="google-signin-btn"
        >
          {googleLoading ? (
            <span className="btn-spinner-dark" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button
            id="login-submit-btn"
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : null}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="login-switch">
          {mode === "signin" ? (
            <>Don&apos;t have an account?{" "}
              <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Sign up</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}>Sign in</button>
            </>
          )}
        </p>

        <p className="login-back">
          <a href="/">← Browse jobs without logging in</a>
        </p>
      </div>
    </div>
  );
}
