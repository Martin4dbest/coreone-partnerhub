"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type ReferralActivity = {
  product: string;
  referral_count: number;
};

export default function StaffReferralCodePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [schoolCount, setSchoolCount] = useState(0);
  const [brainLeagueCount, setBrainLeagueCount] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCode = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: codeData, error: codeError } = await supabase.rpc(
        "coreone_partnerhub_my_referral_code"
      );

      if (codeError) throw codeError;

      if (typeof codeData !== "string" || !codeData.trim()) {
        throw new Error("No referral code was returned.");
      }

      const { data: activityData, error: activityError } =
        await supabase.rpc("coreone_partnerhub_my_referral_activity");

      if (activityError) throw activityError;

      const activity = (
        Array.isArray(activityData) ? activityData : []
      ) as ReferralActivity[];

      const schools = activity.find(
        (item) => item.product === "coreone_school_app"
      );
      const brainLeague = activity.find(
        (item) => item.product === "brainleague"
      );

      setCode(codeData);
      setSchoolCount(Number(schools?.referral_count ?? 0));
      setBrainLeagueCount(Number(brainLeague?.referral_count ?? 0));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your referral information."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCode();
  }, [loadCode]);

  async function copyCode() {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setMessage("Referral code copied.");
      setError("");
    } catch {
      setMessage("");
      setError("Copy was unavailable. Please select and copy the code manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fa] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-teal-800 hover:text-teal-950"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
            Core1 PartnerHub
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            My referral code
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Share this code with schools or users who want to register for
            Core1 School App or BrainLeague. Entering a referral code is
            optional for customers and users.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">
              Loading your referral information...
            </p>
          ) : code ? (
            <>
              <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                  Your unique code
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="break-all text-2xl font-bold tracking-wider text-slate-900">
                    {code}
                  </code>

                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
                  >
                    Copy code
                  </button>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  Your code stays linked to your account. Share the same code
                  for both products.
                </p>
              </div>

              <div className="mt-6">
                <h2 className="font-semibold text-slate-900">
                  My referral activity
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Counts of referral events recorded against your code.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-5">
                    <p className="text-sm font-medium text-slate-600">
                      Schools created
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                      {schoolCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Core1 School App
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-5">
                    <p className="text-sm font-medium text-slate-600">
                      User registrations
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                      {brainLeagueCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      BrainLeague
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {message && (
            <p role="status" className="mt-4 text-sm text-green-700">
              {message}
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadCode()}
            disabled={loading}
            className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </section>
      </div>
    </main>
  );
}
