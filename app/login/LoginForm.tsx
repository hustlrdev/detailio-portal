"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setNote(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const supabase = createClient();

    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError("That email and password don't match. Check them and try again.");
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    if (password.length < 8) { setBusy(false); return setError("Use a password with at least 8 characters."); }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { first_name: String(f.get("first_name") ?? ""), last_name: String(f.get("last_name") ?? "") },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) { router.replace("/setup"); router.refresh(); return; }
    setNote("Check your email and click the link to confirm your account, then sign in.");
  }

  return (
    <form className="form-card" onSubmit={onSubmit} noValidate>
      <p className="form-title">{mode === "in" ? "Sign in" : "Create your business account"}</p>
      {mode === "up" && (
        <div className="grid-2">
          <label className="field"><span className="field-label">First name</span><input name="first_name" autoComplete="given-name" required /></label>
          <label className="field"><span className="field-label">Last name</span><input name="last_name" autoComplete="family-name" required /></label>
        </div>
      )}
      <label className="field"><span className="field-label">Email address</span><input name="email" type="email" autoComplete="email" required /></label>
      <label className="field"><span className="field-label">Password</span><input name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required /></label>
      <p className="form-error" role="alert" aria-live="polite">{error}</p>
      {note && <p className="flash flash-ok" role="status">{note}</p>}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
      <p className="auth-switch" style={{ color: "var(--ink-soft)" }}>
        {mode === "in" ? "New to DETAILIO?" : "Already have an account?"}{" "}
        <button type="button" className="linkish" style={{ color: "var(--jet)", fontWeight: 600 }} onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); setNote(""); }}>
          {mode === "in" ? "Create a business account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
