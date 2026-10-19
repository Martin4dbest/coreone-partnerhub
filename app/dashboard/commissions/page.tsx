"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Commission = {
  id: string;
  referral_id: string;
  amount: number | string;
  currency: string;
  status: string;
};

type BankAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
};

type Payout = {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  payment_reference: string | null;
  requested_at: string;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
};

export default function CommissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bank, setBank] = useState<BankAccount>({
    bank_name: "",
    account_name: "",
    account_number: "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const status = String(
      profile?.application_status ?? profile?.status ?? profile?.state ?? "pending"
    ).toLowerCase();

    if (!["approved", "active"].includes(status)) {
      setError("Your representative account must be approved to access commissions and payouts.");
      setLoading(false);
      return;
    }

    const [commissionResult, payoutResult, bankResult] = await Promise.all([
      supabase
        .from("coreone_partner_commissions")
        .select("id, referral_id, amount, currency, status")
        .eq("partner_id", user.id),
      supabase
        .from("coreone_partner_payouts")
        .select("id, amount, currency, status, payment_reference, requested_at, bank_name, account_name, account_number")
        .eq("partner_id", user.id),
      supabase
        .from("partner_bank_accounts")
        .select("bank_name, account_name, account_number")
        .eq("partner_id", user.id)
        .maybeSingle(),
    ]);

    if (commissionResult.error || payoutResult.error || bankResult.error) {
      setError(
        commissionResult.error?.message ||
        payoutResult.error?.message ||
        bankResult.error?.message ||
        "Unable to load your records."
      );
    } else {
      setCommissions(commissionResult.data ?? []);
      setPayouts(payoutResult.data ?? []);
      setBank({
        bank_name: bankResult.data?.bank_name ?? "",
        account_name: bankResult.data?.account_name ?? "",
        account_number: bankResult.data?.account_number ?? "",
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveBankAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const bankName = bank.bank_name.trim();
    const accountName = bank.account_name.trim();
    const accountNumber = bank.account_number.trim();

    if (!bankName || !accountName || !/^\d{10}$/.test(accountNumber)) {
      setError("Enter the bank name, account name, and a valid 10-digit Nigerian account number.");
      return;
    }

    setSavingBank(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: saveError } = await supabase
        .from("partner_bank_accounts")
        .upsert(
          {
            partner_id: user.id,
            bank_name: bankName,
            account_name: accountName,
            account_number: accountNumber,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "partner_id" }
        );

      if (saveError) throw saveError;

      setBank({
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
      });
      setMessage("Your bank details have been saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save bank details.");
    } finally {
      setSavingBank(false);
    }
  }

  async function requestPayout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setError("Enter a valid payout amount.");
      return;
    }

    if (
      !bank.bank_name.trim() ||
      !bank.account_name.trim() ||
      !/^\d{10}$/.test(bank.account_number.trim())
    ) {
      setError("Save valid bank details before requesting a payout.");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setRequesting(true);

    const { error: insertError } = await supabase
      .from("coreone_partner_payouts")
      .insert({
        partner_id: user.id,
        amount: requestedAmount,
        currency: "NGN",
        status: "requested",
        bank_name: bank.bank_name.trim(),
        account_name: bank.account_name.trim(),
        account_number: bank.account_number.trim(),
      });

    setRequesting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setAmount("");
    setMessage("Your payout request has been submitted.");
    await loadData();
  }

  const naira = (value: number | string, currency = "NGN") =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const total = commissions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFFCF3] px-4 text-xs text-amber-900">
        Loading commissions and payouts...
      </main>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    let styles = "bg-slate-100 text-slate-700 border-slate-200";
    if (s === "approved" || s === "paid" || s === "success") {
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (s === "requested" || s === "pending") {
      styles = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (s === "rejected" || s === "failed") {
      styles = "bg-rose-50 text-rose-700 border-rose-200";
    }
    return `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${styles}`;
  };

  return (
    <main className="min-h-screen bg-[#FFFCF3] px-3 py-5 text-amber-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        
        {/* Navigation / Header */}
        <div>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-[11px] font-medium text-amber-700 transition-colors hover:text-amber-900"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-amber-950 sm:text-2xl">
            Commissions &amp; Payouts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track commissions recorded by CoreOne after successful school onboarding and follow your payout requests.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800 shadow-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 shadow-sm">
            {message}
          </div>
        )}

        {(
          <>
            {/* Overview Stats Cards */}
            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-medium text-slate-500">Total recorded commissions</p>
                <p className="mt-1 text-xs font-bold text-amber-900 sm:text-sm">{naira(total)}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-medium text-slate-500">Commission records</p>
                <p className="mt-1 text-xs font-bold text-amber-900 sm:text-sm">{commissions.length}</p>
              </div>
            </section>

            {/* Commissions List Section */}
            <section className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-sm sm:p-4">
              <h2 className="text-xs font-bold text-amber-950">My Commissions</h2>
              {commissions.length === 0 ? (
                <p className="mt-2.5 text-[11px] text-slate-500">
                  No commissions have been recorded yet. A commission is recorded after CoreOne confirms successful school onboarding[cite: 1].
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {commissions.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-amber-800">
                          {naira(item.amount, item.currency)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500 truncate max-w-xs sm:max-w-sm">
                          Referral ID: <span className="font-mono">{item.referral_id}</span>
                        </p>
                      </div>
                      <div>
                        <span className={getStatusBadge(item.status)}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Representative Bank Details */}
            <section className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-sm sm:p-4">
              <h2 className="text-xs font-bold text-amber-950">Bank Details</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Save the Nigerian bank account where your commissions should be paid.
              </p>
              <form onSubmit={saveBankAccount} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-700">
                  Bank name
                  <input
                    required
                    value={bank.bank_name}
                    onChange={(event) => setBank((previous) => ({ ...previous, bank_name: event.target.value }))}
                    autoComplete="organization"
                    placeholder="e.g. Access Bank"
                    className="mt-1 w-full rounded-lg border border-amber-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-700">
                  Account name
                  <input
                    required
                    value={bank.account_name}
                    onChange={(event) => setBank((previous) => ({ ...previous, account_name: event.target.value }))}
                    autoComplete="name"
                    placeholder="Name registered with bank"
                    className="mt-1 w-full rounded-lg border border-amber-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
                  10-digit account number
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={bank.account_number}
                    onChange={(event) => setBank((previous) => ({ ...previous, account_number: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    placeholder="0123456789"
                    className="mt-1 w-full rounded-lg border border-amber-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
                >
                  {savingBank ? "Saving..." : "Save bank details"}
                </button>
              </form>
            </section>

            {/* Request Payout Section */}
            <section className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-sm sm:p-4">
              <h2 className="text-xs font-bold text-amber-950">Request a Payout</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Submit a request for the administration team to review. Submission does not mean payment has been made[cite: 1].
              </p>
              <form onSubmit={requestPayout} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount in NGN"
                  className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-[#FFFCF3]/40 px-3 py-2 text-[11px] outline-none transition-colors focus:border-amber-500 focus:bg-white sm:text-xs"
                />
                <button
                  type="submit"
                  disabled={requesting}
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-60 sm:text-xs"
                >
                  {requesting ? "Submitting..." : "Request payout"}
                </button>
              </form>
            </section>

            {/* Payout History Section */}
            <section className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-sm sm:p-4">
              <h2 className="text-xs font-bold text-amber-950">Payout History</h2>
              {payouts.length === 0 ? (
                <p className="mt-2.5 text-[11px] text-slate-500">You have not made a payout request yet[cite: 1].</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {payouts.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-amber-800">
                          {naira(item.amount, item.currency)}
                        </p>
                        {(item.bank_name || item.account_name || item.account_number) && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Recipient: {item.account_name || "Account name unavailable"} · {item.bank_name || "Bank unavailable"}
                            {item.account_number ? ` · ****${item.account_number.slice(-4)}` : ""}
                          </p>
                        )}
                        {item.payment_reference && (
                          <p className="mt-0.5 text-[10px] text-slate-500 truncate max-w-xs sm:max-w-sm">
                            Reference: <span className="font-mono">{item.payment_reference}</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <span className={getStatusBadge(item.status)}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}