"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Referral = {
  id: string;
  partner_id: string;
  school_name: string;
  expected_students?: number | null;
  expected_student_range?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  state?: string | null;
  notes?: string | null;
  stage: string;
  created_at: string;
};

type Commission = {
  id: string;
  partner_id: string;
  referral_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

type Payout = {
  id: string;
  partner_id: string;
  partner_name?: string | null;
  full_name?: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_reference?: string | null;
  requested_at?: string | null;
  processed_at?: string | null;
  // Backward compatibility if an RPC returns aliases.
  reference?: string | null;
  created_at?: string | null;
};

type PartnerBankAccount = {
  partner_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
};

type Tab = "referrals" | "commissions" | "payouts";

const stages = [
  { value: "submitted", label: "Submitted" },
  { value: "demo_scheduled", label: "Demo scheduled" },
  { value: "demo_completed", label: "Demo completed" },
  { value: "onboarding", label: "Onboarding" },
  { value: "onboarded", label: "Successfully onboarded" },
  { value: "rejected", label: "Rejected" },
];

const payoutStatuses = [
  "requested",
  "processing",
  "paid",
  "rejected",
];

function money(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

export default function AdminReferralManagementPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("referrals");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, PartnerBankAccount>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) throw adminError;

      if (isAdmin !== true) {
        router.replace("/dashboard");
        return;
      }

      const [referralResult, commissionResult, payoutResult] =
        await Promise.all([
          supabase.rpc("coreone_partnerhub_list_referrals"),
          supabase.rpc("coreone_partnerhub_list_commissions"),
          supabase.rpc("coreone_partnerhub_list_payouts"),
        ]);

      if (referralResult.error) throw referralResult.error;
      if (commissionResult.error) throw commissionResult.error;
      if (payoutResult.error) throw payoutResult.error;

      const payoutRows = Array.isArray(payoutResult.data)
        ? (payoutResult.data as unknown as Payout[])
        : [];
      const partnerIds = [...new Set(payoutRows.map((item) => item.partner_id).filter(Boolean))];

      let bankAccountRows: PartnerBankAccount[] = [];
      if (partnerIds.length > 0) {
        const { data: bankData, error: bankError } = await supabase
          .from("partner_bank_accounts")
          .select("partner_id, bank_name, account_name, account_number")
          .in("partner_id", partnerIds);
        if (bankError) throw bankError;
        bankAccountRows = (bankData ?? []) as PartnerBankAccount[];
      }

      setBankAccounts(
        Object.fromEntries(bankAccountRows.map((item) => [item.partner_id, item]))
      );

      setReferrals(
        Array.isArray(referralResult.data)
          ? (referralResult.data as unknown as Referral[])
          : []
      );
      setCommissions(
        Array.isArray(commissionResult.data)
          ? (commissionResult.data as unknown as Commission[])
          : []
      );
      setPayouts(payoutRows);
    } catch (err) {
      console.error("PartnerHub admin data loading failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : JSON.stringify(err)
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function updateStage(referral: Referral, stage: string) {
    if (stage === "onboarded") {
      if (commissions.some((item) => item.referral_id === referral.id)) {
        setError("A commission already exists for this referral.");
        return;
      }

      const rawCount = window.prompt(
        `Enter the verified total number of students for ${referral.school_name}:`
      );

      if (rawCount === null) return;

      const studentCount = Number(rawCount.trim());

      if (!Number.isSafeInteger(studentCount) || studentCount < 1) {
        setError("Enter a valid whole number of students greater than zero.");
        return;
      }

      if (
        !window.confirm(
          `Confirm onboarding for ${referral.school_name} with ${studentCount} verified students? The active commission tier will be recorded automatically.`
        )
      ) {
        return;
      }

      setWorkingId(referral.id);
      setError("");
      setMessage("");

      try {
        const { error: onboardingError } = await supabase.rpc(
          "coreone_partnerhub_onboard_referral_with_commission",
          {
            target_referral_id: referral.id,
            verified_student_count: studentCount,
          }
        );

        if (onboardingError) throw onboardingError;

        setMessage(
          `Onboarding confirmed for ${referral.school_name}; the tier commission was recorded for ${studentCount} students.`
        );
        await loadData();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not complete onboarding and record the commission."
        );
      } finally {
        setWorkingId("");
      }

      return;
    }

    if (
      !window.confirm(
        `Change ${referral.school_name} to "${readable(stage)}"?`
      )
    ) {
      return;
    }

    setWorkingId(referral.id);
    setError("");
    setMessage("");

    try {
      const { data, error: updateError } = await supabase.rpc(
        "coreone_partnerhub_set_referral_stage",
        {
          target_referral_id: referral.id,
          new_stage: stage,
        }
      );

      if (updateError) throw updateError;
      if (data !== true) throw new Error("The referral stage was not updated.");

      setMessage(`Referral stage updated to ${readable(stage)}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update referral.");
    } finally {
      setWorkingId("");
    }
  }

  async function recordCommission(referral: Referral) {
    const rawAmount = amounts[referral.id]?.trim();

    if (!rawAmount || !Number.isFinite(Number(rawAmount)) || Number(rawAmount) < 0) {
      setError("Enter a valid commission amount.");
      return;
    }

    if (referral.stage !== "onboarded") {
      setError("A commission can only be recorded after successful onboarding.");
      return;
    }

    if (
      !window.confirm(
        `Record ${money(Number(rawAmount))} commission for ${referral.school_name}?`
      )
    ) {
      return;
    }

    setWorkingId(referral.id);
    setError("");
    setMessage("");

    try {
      const { error: commissionError } = await supabase.rpc(
        "coreone_partnerhub_record_commission",
        {
          target_referral_id: referral.id,
          commission_amount: Number(rawAmount),
          commission_currency: "NGN",
        }
      );

      if (commissionError) throw commissionError;

      setMessage(`Commission recorded for ${referral.school_name}.`);
      setAmounts((previous) => ({ ...previous, [referral.id]: "" }));
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to record commission."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function updatePayout(payout: Payout, status: string) {
    if (
      status === "paid" &&
      !window.confirm(
        "Confirm that this payout has actually been paid to the partner?"
      )
    ) {
      return;
    }

    setWorkingId(payout.id);
    setError("");
    setMessage("");

    try {
      const { data, error: payoutError } = await supabase.rpc(
        "coreone_partnerhub_update_payout",
        {
          target_payout_id: payout.id,
          new_status: status,
          payment_reference: references[payout.id]?.trim() || null,
        }
      );

      if (payoutError) throw payoutError;
      if (data !== true) throw new Error("The payout status was not updated.");

      setMessage(`Payout status updated to ${readable(status)}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payout.");
    } finally {
      setWorkingId("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const totalRecorded = commissions.reduce(
    (sum, commission) => sum + Number(commission.amount || 0),
    0
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f7fa] text-[#172b43]">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-[#10253d] sm:text-xl">
            CoreOne <span className="text-teal-700">PartnerHub</span>
          </Link>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link
              href="/admin"
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 sm:text-sm"
            >
              Partner applications
            </Link>
            <button
              onClick={signOut}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 sm:text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#10253d] via-[#153b4b] to-[#17665f] p-5 text-white shadow-lg sm:mb-7 sm:flex-row sm:items-end sm:p-7">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200 sm:text-[11px]">
              CoreOne administration
            </p>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl lg:text-4xl">
              Referrals &amp; commissions
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-200 sm:text-sm sm:leading-6">
              Track school referrals, confirm onboarding, record partner
              commissions, and manage payout requests.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="min-h-11 w-full rounded-lg bg-white px-4 py-3 text-xs font-bold text-[#123b49] shadow-sm transition hover:bg-teal-50 disabled:opacity-50 sm:w-auto sm:text-sm"
          >
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-5 break-words whitespace-pre-wrap rounded-xl border border-red-200 bg-white p-4 text-xs leading-5 text-red-800 shadow-sm sm:text-sm">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="mb-5 break-words rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs leading-5 text-teal-900 shadow-sm sm:text-sm">
            {message}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_14px_rgba(16,37,61,0.04)] transition hover:border-teal-200 sm:p-5">
            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">School referrals</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#10253d] sm:text-3xl">{referrals.length}</p>
          </article>
          <article className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_14px_rgba(16,37,61,0.04)] transition hover:border-teal-200 sm:p-5">
            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">Successfully onboarded</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#10253d] sm:text-3xl">
              {referrals.filter((referral) => referral.stage === "onboarded").length}
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_14px_rgba(16,37,61,0.04)] transition hover:border-teal-200 sm:p-5">
            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">Recorded commissions</p>
            <p className="mt-2 break-words text-xl font-extrabold tracking-tight text-[#10253d] sm:text-2xl">{money(totalRecorded)}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
              Across {commissions.length} commission record(s)
            </p>
          </article>
        </section>

        <div className="mb-5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:mb-6">
          {([
            ["referrals", "School referrals"],
            ["commissions", "Commission history"],
            ["payouts", "Payout requests"],
          ] as [Tab, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`min-h-11 rounded-lg px-3 py-3 text-xs font-bold transition sm:px-4 sm:text-sm ${
                tab === value
                  ? "bg-[#123b49] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500 shadow-sm sm:p-8 sm:text-sm">
            Loading management data...
          </div>
        ) : (
          <>
            {tab === "referrals" && (
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
                  <h2 className="text-base font-bold text-[#10253d]">
                    Referred schools
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Select a school to view its details and update its referral stage.
                  </p>
                </div>

                {referrals.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No school referrals have been submitted yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {referrals.map((referral) => (
                      <button
                        key={referral.id}
                        type="button"
                        onClick={() => {
                          setSelectedReferral(referral);
                          setError("");
                          setMessage("");
                        }}
                        className="block w-full min-w-0 px-4 py-3 text-left transition-colors duration-150 hover:bg-teal-100 focus-visible:outline-none focus-visible:bg-teal-100 sm:px-5 [&:hover_.school-name]:text-teal-900"
                      >
                        <span className="flex min-w-0 items-center justify-between gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="school-name block truncate text-sm font-semibold text-[#10253d] transition-colors duration-150">
                              {referral.school_name}
                              {referral.contact_name && (
                                <span className="ml-2 font-normal text-slate-500">
                                  — {referral.contact_name}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {referral.state || "State not provided"}
                              {" · "}
                              {new Date(referral.created_at).toLocaleDateString()}
                            </span>
                          </span>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${
                              referral.stage === "onboarded"
                                ? "bg-emerald-50 text-emerald-700"
                                : referral.stage === "rejected"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {readable(referral.stage)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "commissions" && (
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(16,37,61,0.04)]">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                  <h2 className="text-base font-bold tracking-tight text-[#10253d] sm:text-lg">Commission history</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    Amounts are entered by an administrator and initially recorded as pending.
                  </p>
                </div>
                {commissions.length === 0 ? (
                  <p className="p-5 text-xs leading-5 text-slate-500 sm:p-8 sm:text-sm">
                    No commissions have been recorded.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {commissions.map((commission) => {
                      const referral = referrals.find(
                        (item) => item.id === commission.referral_id
                      );
                      return (
                        <article key={commission.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                          <div>
                            <h3 className="break-words text-sm font-bold text-[#10253d] sm:text-base">
                              {referral?.school_name || "School referral"}
                            </h3>
                            <p className="mt-1 break-all text-[10px] leading-4 text-slate-500 sm:text-xs">
                              Partner: {commission.partner_id}
                            </p>
                            <p className="break-all text-[10px] leading-4 text-slate-500 sm:text-xs">
                              Referral: {commission.referral_id}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                              Recorded: {new Date(commission.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="min-w-0 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                            <p className="break-words text-lg font-extrabold tracking-tight text-[#10253d] sm:text-xl">
                              {money(commission.amount, commission.currency)}
                            </p>
                            <span className="mt-2 inline-flex max-w-full rounded-full bg-teal-50 px-3 py-1 text-[10px] font-bold text-teal-800 sm:text-xs">
                              {readable(commission.status)}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {tab === "payouts" && (
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(16,37,61,0.04)]">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                  <h2 className="text-base font-bold tracking-tight text-[#10253d] sm:text-lg">
                    Partner payout requests
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    Select a request to review recipient details and update its payment status.
                  </p>
                </div>

                {payouts.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500 sm:p-8">
                    No payout requests have been submitted.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {payouts.map((payout) => (
                      <button
                        key={payout.id}
                        type="button"
                        onClick={() => setSelectedPayout(payout)}
                        className="flex w-full min-w-0 items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block break-words text-base font-extrabold text-[#10253d] sm:text-lg">
                            {money(payout.amount, payout.currency)}
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-slate-700">
                            {payout.partner_name || payout.full_name || payout.partner_id}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Requested {(
                              payout.requested_at || payout.created_at
                            ) ? new Date(
                              payout.requested_at || payout.created_at!
                            ).toLocaleDateString() : "Date unavailable"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 sm:text-xs">
                            {readable(payout.status)}
                          </span>
                          <span aria-hidden="true" className="text-lg text-slate-400">›</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPayout && (
                  <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) {
                        setSelectedPayout(null);
                      }
                    }}
                  >
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="payout-modal-title"
                      className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                    >
                      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-4 backdrop-blur sm:p-6">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                            Payout request details
                          </p>
                          <h2 id="payout-modal-title" className="mt-1 break-words text-xl font-extrabold text-[#10253d] sm:text-2xl">
                            {money(selectedPayout.amount, selectedPayout.currency)}
                          </h2>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {selectedPayout.partner_name || selectedPayout.full_name || selectedPayout.partner_id}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPayout(null)}
                          aria-label="Close payout details"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-500 hover:bg-slate-100"
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-5 p-4 sm:p-6">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Request ID</p>
                            <p className="mt-1 break-all text-xs font-medium text-slate-800">{selectedPayout.id}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Current status</p>
                            <p className="mt-1 text-sm font-bold text-slate-800">{readable(selectedPayout.status)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Requested</p>
                            <p className="mt-1 text-sm text-slate-800">
                              {(selectedPayout.requested_at || selectedPayout.created_at)
                                ? new Date(selectedPayout.requested_at || selectedPayout.created_at!).toLocaleString()
                                : "Date unavailable"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Processed</p>
                            <p className="mt-1 text-sm text-slate-800">
                              {selectedPayout.processed_at
                                ? new Date(selectedPayout.processed_at).toLocaleString()
                                : "Not yet processed"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                          <h3 className="text-sm font-bold text-teal-950">Recipient bank details</h3>
                          {bankAccounts[selectedPayout.partner_id] ? (
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              <p><span className="font-semibold">Bank:</span> {bankAccounts[selectedPayout.partner_id].bank_name}</p>
                              <p><span className="font-semibold">Account name:</span> {bankAccounts[selectedPayout.partner_id].account_name}</p>
                              <p className="break-all"><span className="font-semibold">Account number:</span> {bankAccounts[selectedPayout.partner_id].account_number}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-amber-800">
                              Bank details not found. Verify that the representative has saved their account details.
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                          <h3 className="text-sm font-bold text-[#10253d]">Payment processing</h3>
                          {(selectedPayout.payment_reference || selectedPayout.reference) && (
                            <p className="mt-2 break-all text-xs text-slate-600">
                              Existing reference: {selectedPayout.payment_reference || selectedPayout.reference}
                            </p>
                          )}
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-slate-700 sm:text-sm">
                              Payment reference (optional)
                              <input
                                value={references[selectedPayout.id] ?? ""}
                                onChange={(event) =>
                                  setReferences((previous) => ({
                                    ...previous,
                                    [selectedPayout.id]: event.target.value,
                                  }))
                                }
                                placeholder="Bank transfer reference"
                                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700 sm:text-sm">
                              Update status
                              <select
                                id={`payout-status-${selectedPayout.id}`}
                                key={`${selectedPayout.id}-${selectedPayout.status}`}
                                defaultValue={selectedPayout.status}
                                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                              >
                                {payoutStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {readable(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={workingId === selectedPayout.id}
                            onClick={() => {
                              const element = document.getElementById(
                                `payout-status-${selectedPayout.id}`
                              ) as HTMLSelectElement | null;
                              if (element) {
                                void updatePayout(selectedPayout, element.value);
                              }
                            }}
                            className="mt-4 min-h-11 w-full rounded-lg bg-[#123b49] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#185b5a] disabled:opacity-50"
                          >
                            {workingId === selectedPayout.id ? "Saving..." : "Save payout update"}
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {selectedReferral && (() => {
          const referral =
            referrals.find((item) => item.id === selectedReferral.id) ??
            selectedReferral;
          const commissionExists = commissions.some(
            (item) => item.referral_id === referral.id
          );
          const activeStageIndex = stages.findIndex(
            (item) => item.value === referral.stage
          );
          const timelineStages = stages.filter(
            (item) => item.value !== "rejected"
          );

          return (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedReferral(null);
                }
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="referral-modal-title"
                className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
              >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                      School referral details
                    </p>
                    <h2 id="referral-modal-title" className="mt-1 break-words text-lg font-semibold tracking-tight text-[#10253d] sm:text-xl">
                      {referral.school_name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReferral(null)}
                    aria-label="Close school details"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18 6-12 12M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Representative / Contact person</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{referral.contact_name || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{referral.contact_phone || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                      <p className="mt-1 break-all text-sm font-medium text-slate-800">{referral.contact_email || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Location</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{referral.state || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expected student population</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {referral.expected_student_range === "Above 1,000"
                          ? `Above 1,000 (exact estimate: ${referral.expected_students ?? "not recorded"})`
                          : referral.expected_student_range ?? "Not recorded"}
                      </p>
                    </div>
                  </div>

                  {referral.notes && (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-700">Referral notes</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{referral.notes}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#10253d]">Referral progress</h3>
                        <p className="mt-1 text-xs text-slate-500">Track each stage from submission to onboarding.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        referral.stage === "onboarded"
                          ? "bg-emerald-50 text-emerald-700"
                          : referral.stage === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}>
                        {readable(referral.stage)}
                      </span>
                    </div>

                    {referral.stage === "rejected" ? (
                      <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                        This referral is marked as rejected.
                      </div>
                    ) : (
                      <ol className="mt-5 space-y-0">
                        {timelineStages.map((stage, index) => {
                          const completed = activeStageIndex >= 0 && index <= activeStageIndex;
                          const current = stage.value === referral.stage;

                          return (
                            <li key={stage.value} className="flex gap-3">
                              <div className="flex w-5 shrink-0 flex-col items-center">
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                                  completed
                                    ? "border-teal-700 bg-teal-700 text-white"
                                    : "border-slate-300 bg-white text-slate-400"
                                }`}>
                                  {completed ? "✓" : index + 1}
                                </span>
                                {index < timelineStages.length - 1 && (
                                  <span className={`my-1 min-h-5 w-px flex-1 ${
                                    completed && index < activeStageIndex ? "bg-teal-500" : "bg-slate-200"
                                  }`} />
                                )}
                              </div>
                              <div className="pb-4">
                                <p className={`text-xs ${current ? "font-bold text-teal-800" : completed ? "font-medium text-slate-700" : "text-slate-500"}`}>
                                  {stage.label}
                                  {current ? " · Current stage" : ""}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    <label className="mt-2 block text-xs font-semibold text-slate-700">
                      Update referral stage
                      <select
                        value={referral.stage}
                        disabled={workingId === referral.id}
                        onChange={(event) => void updateStage(referral, event.target.value)}
                        className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                      >
                        {stages.map((stage) => (
                          <option key={stage.value} value={stage.value}>{stage.label}</option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      Confirming successful onboarding will request the verified student count and record the applicable tier commission.
                    </p>
                  </div>

                  {referral.stage === "onboarded" && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-teal-950">Commission</h3>
                        {commissionExists ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800">Already recorded</span>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">Not yet recorded</span>
                        )}
                      </div>

                      {!commissionExists && (
                        <>
                          <p className="mt-2 text-xs leading-5 text-teal-900">
                            Use the verified student count to calculate the active commission tier.
                          </p>
                          <button
                            type="button"
                            onClick={() => void updateStage(referral, "onboarded")}
                            disabled={workingId === referral.id}
                            className="mt-3 min-h-10 w-full rounded-lg bg-[#17665f] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#124f4a] disabled:opacity-50 sm:w-auto"
                          >
                            {workingId === referral.id ? "Processing..." : "Verify students & calculate commission"}
                          </button>

                          <details className="mt-4 border-t border-teal-200 pt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-teal-950">
                              Manual commission entry (fallback)
                            </summary>
                            <label className="mt-3 block text-xs font-semibold text-slate-700">
                              Commission amount (NGN)
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amounts[referral.id] ?? ""}
                                onChange={(event) => setAmounts((previous) => ({
                                  ...previous,
                                  [referral.id]: event.target.value,
                                }))}
                                placeholder="Enter approved amount"
                                className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal-600"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void recordCommission(referral)}
                              disabled={workingId === referral.id}
                              className="mt-3 min-h-10 w-full rounded-lg bg-[#243b53] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#10253d] disabled:opacity-50"
                            >
                              {workingId === referral.id ? "Saving..." : "Record commission manually"}
                            </button>
                          </details>
                        </>
                      )}
                    </div>
                  )}

                  <div className="break-all border-t border-slate-100 pt-4 text-[10px] leading-5 text-slate-400">
                    <p>Referring partner ID: {referral.partner_id}</p>
                    <p>Referral ID: {referral.id}</p>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedReferral(null)}
                      className="min-h-10 w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                    >
                      Close details
                    </button>
                  </div>
                </div>
              </section>
            </div>
          );
        })()}

        <p className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] leading-5 text-slate-500 sm:mt-8 sm:px-5 sm:text-xs sm:leading-6">
          Commission recording is restricted to referrals marked successfully onboarded.
          This page does not initiate bank transfers; payout status must reflect an
          actual administrative decision or confirmed payment.
        </p>
      </div>
    </main>
  );
}
