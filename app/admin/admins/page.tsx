"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Admin = {
  user_id: string;
  email: string;
  created_at: string;
};

export default function AdminManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const primaryEmail = "core1enterprisesolutions@gmail.com";

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: primaryData, error: primaryError } =
        await supabase.rpc("coreone_partnerhub_is_primary_admin");

      if (primaryError) throw primaryError;

      if (primaryData !== true) {
        setIsPrimary(false);
        setAdmins([]);
        setError(
          "Only the primary administrator can manage administrator accounts."
        );
        return;
      }

      setIsPrimary(true);

      const { data, error: listError } = await supabase.rpc(
        "coreone_partnerhub_list_admins"
      );

      if (listError) throw listError;

      setAdmins(Array.isArray(data) ? (data as Admin[]) : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load administrators."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  async function addAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter the email address of the new administrator.");
      return;
    }

    if (normalizedEmail === primaryEmail) {
      setError("The primary administrator is already protected.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: addError } = await supabase.rpc(
        "coreone_partnerhub_add_admin",
        { target_email: normalizedEmail }
      );

      if (addError) throw addError;
      if (data !== true) throw new Error("Administrator access was not added.");

      setEmail("");
      setMessage("Administrator access added successfully.");
      await loadAdmins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add administrator."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(admin: Admin) {
    if (admin.email.toLowerCase() === primaryEmail) {
      setError("The primary administrator cannot be removed.");
      return;
    }

    if (!window.confirm(`Remove administrator access for ${admin.email}?`)) {
      return;
    }

    setError("");
    setMessage("");
    setWorkingId(admin.user_id);

    try {
      const { data, error: removeError } = await supabase.rpc(
        "coreone_partnerhub_remove_admin",
        { target_user_id: admin.user_id }
      );

      if (removeError) throw removeError;
      if (data !== true) {
        throw new Error("No administrator access was removed.");
      }

      setMessage(`Administrator access removed for ${admin.email}.`);
      await loadAdmins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove administrator."
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/admin" className="text-base font-extrabold tracking-tight">
            CoreOne <span className="text-amber-600">PartnerHub</span>
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Primary administrator
          </p>
          <h1 className="mt-1 text-xl font-extrabold">
            Administrator Management
          </h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Add registered users as administrators or revoke their
            administrator access. Only the primary administrator can use this
            page.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
          >
            {message}
          </div>
        )}

        {isPrimary && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold">Add an administrator</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                The person must already have an account in CoreOne PartnerHub.
              </p>

              <form
                onSubmit={addAdmin}
                className="mt-4 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter registered email address"
                  aria-label="New administrator email"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add administrator"}
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold">Administrator accounts</h2>
                <button
                  type="button"
                  onClick={() => void loadAdmins()}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="p-4 text-xs text-slate-500">
                  Loading administrators...
                </p>
              ) : admins.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  No administrator accounts were returned.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {admins.map((admin) => {
                    const primary =
                      admin.email.toLowerCase() === primaryEmail;

                    return (
                      <article
                        key={admin.user_id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="break-all text-xs font-semibold">
                            {admin.email}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Added{" "}
                            {new Date(admin.created_at).toLocaleDateString()}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${
                              primary
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {primary ? "Primary administrator" : "Administrator"}
                          </span>
                        </div>

                        {!primary && (
                          <button
                            type="button"
                            disabled={workingId === admin.user_id}
                            onClick={() => void removeAdmin(admin)}
                            className="self-start rounded-lg border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50 sm:self-center"
                          >
                            {workingId === admin.user_id
                              ? "Removing..."
                              : "Remove access"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
