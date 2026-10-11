"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Partner = {
  id?: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  status?: string;
  state?: string;
  role?: string;
  created_at?: string;
  [key: string]: unknown;
};

export default function AdminPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  const loadPartners = useCallback(async () => {
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

      const { data: adminData, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) throw adminError;

      if (adminData !== true) {
        setError(
          "Administrator access is not enabled for this account. Sign in with core1enterprisesolutions@gmail.com after it has been added to the administrator allowlist."
        );
        setPartners([]);
        return;
      }

      const { data, error: partnersError } = await supabase.rpc(
        "coreone_partnerhub_list_partners"
      );

      if (partnersError) throw partnersError;

      const rows = Array.isArray(data)
        ? data
        : data
          ? [data]
          : [];

      setPartners(rows as Partner[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load partner applications."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  async function updateStatus(partner: Partner, status: string) {
    const id = partner.id ?? partner.user_id;

    if (!id) {
      setError("This partner record has no user ID, so it cannot be updated.");
      return;
    }

    const label = status === "approved"
      ? "approve"
      : status === "rejected"
        ? "reject"
        : "return to pending";

    if (!window.confirm(`Are you sure you want to ${label} this application?`)) {
      return;
    }

    setWorkingId(id);
    setError("");
    setMessage("");

    try {
      const { data, error: updateError } = await supabase.rpc(
        "coreone_partnerhub_set_partner_status",
        {
          target_user_id: id,
          new_status: status,
        }
      );

      if (updateError) throw updateError;

      if (data !== true) {
        throw new Error(
          "No partner record was updated. Check that this profile exists and its ID matches the account ID."
        );
      }

      setMessage(`Partner application ${status} successfully.`);
      await loadPartners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The application status could not be updated."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const getStatus = (partner: Partner) =>
    String(partner.status ?? partner.state ?? "pending").toLowerCase();

  const filteredPartners = partners.filter((partner) => {
    if (filter === "all") return true;
    return getStatus(partner) === filter;
  });

  const pendingCount = partners.filter(
    (partner) => !["approved", "active", "rejected", "suspended"].includes(
      getStatus(partner)
    )
  ).length;

  const approvedCount = partners.filter((partner) =>
    ["approved", "active"].includes(getStatus(partner))
  ).length;

  const rejectedCount = partners.filter(
    (partner) => getStatus(partner) === "rejected"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            CoreOne <span className="text-rose-600">PartnerHub</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold">
              Administrator
            </span>
            <button
              onClick={signOut}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-600">
              CoreOne administration
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Partner applications
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Review representative registrations and control who is approved
              to submit school referrals.
            </p>
          </div>
          <Link
            href="/admin/representatives"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Registered Representatives
          </Link>
          <button
            onClick={() => void loadPartners()}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh applications"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending review</p>
            <p className="mt-3 text-3xl font-extrabold">{pendingCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Approved partners</p>
            <p className="mt-3 text-3xl font-extrabold">{approvedCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Rejected applications</p>
            <p className="mt-3 text-3xl font-extrabold">{rejectedCount}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-bold">Registered partners</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredPartners.length} application(s)
              </p>
            </div>
            <select
              aria-label="Filter partner applications"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All applications</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-slate-500">
              Loading partner applications...
            </p>
          ) : filteredPartners.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-bold">No applications found</h3>
              <p className="mt-2 text-sm text-slate-500">
                Applications will appear here when partner profiles are
                available in Supabase.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPartners.map((partner, index) => {
                const id = partner.id ?? partner.user_id ?? `partner-${index}`;
                const status = getStatus(partner);
                const isWorking = workingId === id;
                const displayStatus =
                  status.charAt(0).toUpperCase() + status.slice(1);

                return (
                  <article
                    key={id}
                    className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="break-words font-bold">
                        {partner.full_name || "Name not provided"}
                      </h3>
                      <p className="mt-1 break-all text-sm text-slate-600">
                        {partner.email || "Email not provided"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                        <span>
                        </span>
                        {partner.created_at && (
                          <span>
                            Registered:{" "}
                            {new Date(partner.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                        {displayStatus}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {status !== "approved" && status !== "active" && (
                        <button
                          disabled={isWorking}
                          onClick={() => void updateStatus(partner, "approved")}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isWorking ? "Saving..." : "Approve"}
                        </button>
                      )}
                      {status !== "rejected" && (
                        <button
                          disabled={isWorking}
                          onClick={() => void updateStatus(partner, "rejected")}
                          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      {status !== "pending" && (
                        <button
                          disabled={isWorking}
                          onClick={() => void updateStatus(partner, "pending")}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                        >
                          Return to pending
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-rose-700">Administration</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
                Referral, Commission &amp; Payout Management
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Manage school referrals, update onboarding progress, record commissions after successful onboarding, and review representative payout requests.
              </p>
            </div>
            <div className="mt-5 flex shrink-0 flex-wrap gap-3 sm:mt-0">
              <Link
                href="/admin/referrals"
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
              >
                Manage referrals <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <Link
                href="/admin/admins"
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
              >
                Manage administrators <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <Link
                href="/admin/commission-tiers"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Commission Tiers <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-slate-500">
          Administrator actions are checked by Supabase. Approving an
          application does not itself create a commission; commission should
          only be recorded after CoreOne confirms successful school onboarding.
        </p>
      </div>
    </main>
  );
}
