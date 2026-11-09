"use client";
import { useActionState } from "react";
import { adminLogin } from "./actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="form-card">
      <h1 className="form-title">Admin sign in</h1>
      <label className="field">
        <span className="field-label">Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="field">
        <span className="field-label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <p className="form-error" role="alert">{state?.error}</p>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}