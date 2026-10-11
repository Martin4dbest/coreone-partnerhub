"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Row = Record<string, unknown>;

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function label(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProfileFields({ title, data }: { title: string; data: Row }) {
  const entries = Object.entries(data).filter(([key, value]) => {
    if (value === null || value === undefined || key.startsWith("_")) return false;
    if (/password|secret|token|access_key|refresh_key|private_key/i.test(key)) return false;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return false;
    return true;
  });

  if (!entries.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-4">
        <h2 className="font-extrabold">{title}</h2>
      </div>
      <dl className="grid gap-px bg-slate-100 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 bg-white p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {label(key)}
            </dt>
            <dd className="mt-1 break-words text-[11px] text-slate-900">
              {typeof value === "object" && value !== null ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-[11px]">
                  {displayValue(value)}
                </pre>
              ) : (
                displayValue(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActivitySection({
  title,
  rows,
  partnerNames,
  referralNames,
}: {
  title: string;
  rows: Row[];
  partnerNames: Record<string, string>;
  referralNames: Record<string, string>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-4">
        <h2 className="font-extrabold">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-[11px] text-slate-500">No records found.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <div key={String(row.id || index)} className="grid gap-2 p-3 sm:grid-cols-2">
              {Object.entries(row)
                .filter(([key, value]) => value !== null && value !== undefined && !/password|secret|token|account_number/i.test(key))
                .map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">{label(key)}</p>
                    <p className="mt-1 break-words text-[11px]">
                      {key === "partner_id"
                        ? partnerNames[String(value)] || "Name not available"
                        : key === "referral_id"
                          ? referralNames[String(value)] || "Referral record"
                          : displayValue(value)}
                    </p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RepresentativeProfileContent() {
  const params = useParams<{ partnerId: string }>();
  const partnerId = decodeURIComponent(params.partnerId);
  const router = useRouter();

  const [profile, setProfile] = useState<Row | null>(null);
  const [referrals, setReferrals] = useState<Row[]>([]);
  const [commissions, setCommissions] = useState<Row[]>([]);
  const [payouts, setPayouts] = useState<Row[]>([]);
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({});
  const [referralNames, setReferralNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const { data: admin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );
      if (adminError) throw adminError;
      if (admin !== true) {
        router.replace("/dashboard");
        return;
      }

      const [partnersResult, referralsResult, commissionsResult, payoutsResult] =
        await Promise.all([
          supabase.rpc("coreone_partnerhub_list_partners"),
          supabase.rpc("coreone_partnerhub_list_referrals"),
          supabase.rpc("coreone_partnerhub_list_commissions"),
          supabase.rpc("coreone_partnerhub_list_payouts"),
        ]);

      if (partnersResult.error) throw partnersResult.error;
      if (referralsResult.error) throw referralsResult.error;
      if (commissionsResult.error) throw commissionsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;

      const partners = Array.isArray(partnersResult.data)
        ? partnersResult.data as Row[]
        : [];

      const getName = (p: Row) =>
        String(
          p.full_name ||
          p.name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          p.representative_name ||
          p.contact_name ||
          p.email ||
          ""
        ).trim();

      const names: Record<string, string> = {};
      for (const p of partners) {
        const personName = getName(p) || "Name not provided";
        for (const key of [p.id, p.user_id, p.partner_id]) {
          if (key) names[String(key)] = personName;
        }
      }
      setPartnerNames(names);

      const found = partners.find((p) =>
        [p.id, p.user_id, p.partner_id].some(
          (key) => key != null && String(key) === partnerId
        )
      );

      if (!found) {
        setError("This representative could not be found in the registered profiles.");
        return;
      }

      setProfile(found);

      const matches = (row: Row) =>
        String(row.partner_id || row.user_id || "") === partnerId;

      const allReferrals = Array.isArray(referralsResult.data)
        ? referralsResult.data as Row[]
        : [];

      setReferralNames(
        Object.fromEntries(
          allReferrals
            .filter((row) => row.id)
            .map((row) => [
              String(row.id),
              String(row.school_name || row.contact_name || "School referral"),
            ])
        )
      );

      setReferrals(allReferrals.filter(matches));
      setCommissions(
        (Array.isArray(commissionsResult.data) ? commissionsResult.data as Row[] : [])
          .filter(matches)
      );
      setPayouts(
        (Array.isArray(payoutsResult.data) ? payoutsResult.data as Row[] : [])
          .filter(matches)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load representative profile.");
    } finally {
      setLoading(false);
    }
  }, [partnerId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const application = profile?.application_details;
  const applicationFields =
    application && typeof application === "object" && !Array.isArray(application)
      ? application as Row
      : {};

  const profileFields = profile ? { ...profile } : {};
  delete profileFields.application_details;
  delete profileFields.id;
  delete profileFields.user_id;
  delete profileFields.partner_id;

  const name = String(
    profile?.full_name ||
    profile?.name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Representative profile"
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="text-[11px] font-bold">
            CoreOne <span className="text-rose-600">PartnerHub</span>
          </Link>
          <Link href="/admin/representatives" className="text-[11px] font-semibold text-slate-600 hover:text-rose-600">
            ← Representatives
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600">
              Representative details
            </p>
            <h1 className="mt-1 break-words text-[11px] font-bold">
              {loading ? "Loading profile..." : name}
            </h1>
            <p className="mt-1 break-words text-[11px] text-slate-500">
              {String(profile?.email || "Representative profile")}
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-4 py-3 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh profile"}
          </button>
        </div>

        {error && (
          <div role="alert" className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-3 text-center text-slate-500">Loading representative information...</p>
        ) : profile ? (
          <>
            <ProfileFields title="Registered profile details" data={profileFields} />
            <ProfileFields title="Application details" data={applicationFields} />
            <ActivitySection title="School referrals" rows={referrals} partnerNames={partnerNames} referralNames={referralNames} />
            <ActivitySection title="Commission history" rows={commissions} partnerNames={partnerNames} referralNames={referralNames} />
            <ActivitySection title="Payout history" rows={payouts} partnerNames={partnerNames} referralNames={referralNames} />
          </>
        ) : null}
      </div>
    </main>
  );
}


export default function RepresentativeProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-4 text-[11px] text-slate-600">
          Loading representative profile...
        </main>
      }
    >
      <RepresentativeProfileContent />
    </Suspense>
  );
}
