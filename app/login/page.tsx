"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) throw loginError;

      if (!data.user) {
        throw new Error("Sign-in succeeded, but no user account was returned.");
      }

      // Determine administrator access from the server-side Supabase allowlist.
      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) {
        throw new Error(
          "You are signed in, but we could not verify your access permissions. Please try again."
        );
      }

      router.replace(isAdmin === true ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign-in failed. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-compact">
        <Link href="/" className="auth-back">
          ← Back to PartnerHub
        </Link>

        <div className="auth-heading">
          <span className="auth-eyebrow">WELCOME BACK</span>
          <h1>Sign in to PartnerHub</h1>
          <p>Access your representative or administrator account.</p>
        </div>

        {error && (
          <div className="auth-alert auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email address
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              type="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              type="password"
              placeholder="Your password"
            />
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          New to PartnerHub?{" "}
          <Link href="/register">Apply to become a representative</Link>
        </p>
      </section>
    </main>
  );
}
