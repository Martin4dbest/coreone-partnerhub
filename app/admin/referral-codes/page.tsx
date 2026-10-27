"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type ReferralActivityRow = {
  partner_id: string;
  referral_code: string;
  staff_name: string;
  email: string | null;
  created_at: string;
  school_count: number;
  brainleague_count: number;
};

export default function AdminReferralCodesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReferralActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCodes = useCallback(async () => {
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

      const { data: adminData, error: adminError } =
        await supabase.rpc("is_coreone_partnerhub_admin");

      if (adminError) throw adminError;

      if (adminData !== true) {
        router.replace("/dashboard");
        return;
      }

      const { data, error: listError } = await supabase.rpc(
        "coreone_partnerhub_list_referral_activity"
      );

      if (listError) throw listError;

      setRows(
        (Array.isArray(data) ? data : []) as ReferralActivityRow[]
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load referral activity."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`Copied ${code}.`);
      setError("");
    } catch {
      setMessage("");
      setError("Unable to copy the code. Please copy it manually.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="text-sm font-semibold text-rose-700 hover:text-rose-900"
        >
          ← Back to administration
        </Link>

        <header className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
            Core1 PartnerHub
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Staff referral codes and activity
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            View approved staff referral codes and the recorded school
            onboarding and BrainLeague registration activity attributed to
            each code. Counts reflect recorded referral events.
          </p>

          <button
            type="button"
            onClick={() => void loadCodes()}
            disabled={loading}
            className="mt-5 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            Refresh report
          </button>
        </header>

        {message && (
          <p role="status" className="mt-4 text-sm text-green-700">
            {message}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">
              Approved staff activity
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading referral activity..."
                : `${rows.length} staff referral record${rows.length === 1 ? "" : "s"} found`}
            </p>
          </div>

          {!loading && !error && rows.length === 0 && (
            <p className="p-6 text-sm text-slate-600">
              No referral codes have been generated yet. An approved staff
              member receives a code when they open their referral-code page.
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Staff member</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Referral code</th>
                    <th className="px-5 py-3 font-semibold">Schools created</th>
                    <th className="px-5 py-3 font-semibold">BrainLeague registrations</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.partner_id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {row.staff_name || "Approved staff"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.email || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <code className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-800">
                          {row.referral_code}
                        </code>
                      </td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">
                        {Number(row.school_count ?? 0)}
                      </td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">
                        {Number(row.brainleague_count ?? 0)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void copyCode(row.referral_code)}
                          className="font-semibold text-rose-700 hover:text-rose-900"
                        >
                          Copy code
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
