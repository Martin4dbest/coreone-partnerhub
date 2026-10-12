"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Application = {
  education_level?: string;
  nysc_completed?: boolean | null;
  age?: number | null;
  gender?: string;
};

type Registration = {
  full_name?: string;
  phone?: string;
  state?: string;
  city?: string;
  address?: string;
  organization?: string;
  education_level?: string;
  nysc_completed?: string | boolean | null;
  age?: string | number;
  gender?: string;
};

type Partner = {
  id?: string;
  user_id?: string;
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  organization_name?: string;
  company_name?: string;
  status?: string;
  state?: string;
  city?: string;
  address?: string;
  referral_code?: string;
  application_status?: string;
  created_at?: string;
  registration_details?: Registration;
  application_details?: Application | null;
  [key: string]: unknown;
};

function locationValue(primary: unknown, registered: unknown) {
  const candidates = [registered, primary];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    if (["approved", "pending", "rejected"].includes(candidate.trim().toLowerCase())) continue;
    return candidate.trim();
  }
  return undefined;
}

function partnerName(p: Partner) {
  return p.registration_details?.full_name?.trim() ||
    p.full_name?.trim() ||
    p.name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(" ") ||
    "Name not provided";
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function RepresentativesPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");
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

      const { data, error: listError } = await supabase.rpc(
        "coreone_partnerhub_list_partners"
      );
      if (listError) throw listError;

      const rows: Partner[] = Array.isArray(data)
        ? (data as Partner[])
        : data
          ? [data as Partner]
          : [];

      setPartners(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load representatives.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = partners.filter((p) => {
    const registration = p.registration_details;
    const text = [
      partnerName(p),
      p.email,
      registration?.phone,
      p.phone,
      registration?.organization,
      p.organization,
      p.organization_name,
      p.company_name,
      p.status,
      p.state,
      p.city,
    ].filter(Boolean).join(" ").toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-[13px] font-extrabold">
            CoreOne <span className="text-amber-600">PartnerHub</span>
          </Link>
          <Link href="/admin" className="text-[12px] font-semibold text-slate-600 hover:text-amber-700">
            ← Admin dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
              PartnerHub administration
            </p>
            <h1 className="mt-2 text-[20px] font-extrabold">
              Registered Representatives
            </h1>
            <p className="mt-2 text-[12px] text-slate-600">
              Review representatives’ personal and education details before making an approval decision.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg bg-amber-500 px-4 py-2.5 text-[12px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        <div className="mt-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or organization..."
            aria-label="Search representatives"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-[12px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            {error}
          </div>
        )}

        <div className="mt-4 text-[11px] text-slate-500">
          {filtered.length} representative(s)
        </div>

        {loading ? (
          <p className="py-12 text-center text-[12px] text-slate-500">Loading representatives...</p>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="text-[14px] font-bold">No representatives found</h2>
            <p className="mt-2 text-[12px] text-slate-500">Try another search or refresh the list.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filtered.map((p, i) => {
              const id = p.id || p.user_id;
              const registration = p.registration_details;
              const application = p.application_details;
              const status = String(p.application_status || p.approval_status || p.status || "pending");
              const organization =
                registration?.organization ||
                p.organization ||
                p.organization_name ||
                p.company_name;

              return (
                <article key={id || i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-[15px] font-extrabold">{partnerName(p)}</h2>
                      <p className="mt-1 break-all text-[12px] text-slate-600">
                        {p.email || "Email not provided"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold capitalize">
                      {status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <h3 className="mt-5 border-b border-slate-100 pb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Personal and contact details
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-[12px] sm:grid-cols-2">
                    <div><dt className="text-[10px] font-semibold text-slate-500">Phone</dt><dd className="mt-0.5 break-words">{display(registration?.phone || p.phone)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">Organization</dt><dd className="mt-0.5 break-words">{display(organization)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">Age</dt><dd className="mt-0.5">{display(application?.age ?? registration?.age)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">Gender</dt><dd className="mt-0.5 capitalize">{display(application?.gender || registration?.gender)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">State</dt><dd className="mt-0.5">{display(locationValue(p.state, registration?.state))}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">City</dt><dd className="mt-0.5">{display(locationValue(p.city, registration?.city))}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-[10px] font-semibold text-slate-500">Address</dt><dd className="mt-0.5 break-words">{display(locationValue(p.address, registration?.address))}</dd></div>
                  </dl>

                  <h3 className="mt-5 border-b border-slate-100 pb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Education and application
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-[12px] sm:grid-cols-2">
                    <div><dt className="text-[10px] font-semibold text-slate-500">Education level</dt><dd className="mt-0.5 capitalize">{display(application?.education_level || registration?.education_level)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">NYSC completed</dt><dd className="mt-0.5">{display(application?.nysc_completed ?? registration?.nysc_completed)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">Referral code</dt><dd className="mt-0.5">{display(p.referral_code)}</dd></div>
                    <div><dt className="text-[10px] font-semibold text-slate-500">Registered</dt><dd className="mt-0.5">{p.created_at ? new Date(p.created_at).toLocaleString() : "Not available"}</dd></div>
                  </dl>


                  {id ? (
                    <Link
                      href={`/admin/representatives/${encodeURIComponent(id)}`}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-3 text-[12px] font-bold text-slate-950 hover:bg-amber-400"
                    >
                      Open representative profile →
                    </Link>
                  ) : (
                    <p className="mt-4 text-[11px] text-amber-800">This record has no profile ID.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
