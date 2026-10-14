"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Profile = Record<string, unknown>;

type Stats = {
  referrals: number;
  onboarded: number;
  total: number;
  paid: number;
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);

function profileText(profile: Profile | null, keys: string[]) {
  for (const key of keys) {
    const value = profile?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Representative");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [status, setStatus] = useState("pending");
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    referrals: 0,
    onboarded: 0,
    total: 0,
    paid: 0,
  });


  useEffect(() => {
    const saved = window.localStorage.getItem("coreone-partnerhub-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("coreone-partnerhub-theme", theme);
  }, [theme]);

  const approved = ["approved", "active"].includes(status);

  const loadPhoto = useCallback(async (userId: string) => {
    const bucket = supabase.storage.from("partner-avatars");
    const { data, error } = await bucket.list(userId);

    if (error || !data) {
      setPhoto("");
      return;
    }

    const latest = data
      .filter((item) => /^profile-.*\.(jpg|jpeg|png|webp)$/i.test(item.name))
      .sort((a, b) =>
        (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
      )[0];

    if (!latest) {
      setPhoto("");
      return;
    }

    const { data: signed } = await bucket.createSignedUrl(
      `${userId}/${latest.name}`,
      3600
    );

    setPhoto(signed?.signedUrl ?? "");
  }, []);

  const loadDashboard = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setEmail(user.email ?? "");

    const metadata = user.user_metadata ?? {};
    setName(
      metadata.full_name ||
        metadata.name ||
        user.email?.split("@")[0] ||
        "Representative"
    );

    const { data } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const profile = data as Profile | null;

    if (!profile) {
      setOrganization(
        String(
          metadata.organization ||
          metadata.organization_name ||
          metadata.company_name ||
          ""
        ).trim()
      );
    }

    if (profile) {
      const fullName =
        profileText(profile, ["full_name", "name"]) ||
        [
          profileText(profile, ["first_name"]),
          profileText(profile, ["last_name"]),
        ]
          .filter(Boolean)
          .join(" ");

      if (fullName) setName(fullName);

      setOrganization(
        profileText(profile, [
          "organization_name",
          "organization",
          "company_name",
        ]) ||
        String(
          metadata.organization ||
          metadata.organization_name ||
          metadata.company_name ||
          ""
        ).trim()
      );

      setStatus(
        profileText(profile, ["application_status", "status", "state"]).toLowerCase() || "pending"
      );
    }

    const [referralResult, commissionResult, payoutResult] = await Promise.all([
      supabase
        .from("coreone_partner_referrals")
        .select("id,stage", { count: "exact" })
        .eq("partner_id", user.id),

      supabase
        .from("coreone_partner_commissions")
        .select("amount")
        .eq("partner_id", user.id),

      supabase
        .from("coreone_partner_payouts")
        .select("amount,status")
        .eq("partner_id", user.id),
    ]);

    if (referralResult.error || commissionResult.error || payoutResult.error) {
      console.error("Partner dashboard data query failed:", {
        referrals: referralResult.error,
        commissions: commissionResult.error,
        payouts: payoutResult.error,
        userId: user.id,
      });

      setMessage(
        "Some dashboard figures could not be loaded. Please refresh; if the issue continues, contact CoreOne Partner Support."
      );
    }

    const referrals = referralResult.data ?? [];
    const commissions = commissionResult.data ?? [];
    const payouts = payoutResult.data ?? [];

    setStats({
      referrals: referralResult.count ?? referrals.length,
      onboarded: referrals.filter((r) => r.stage === "onboarded").length,
      total: commissions.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      ),
      paid: payouts
        .filter((p) => String(p.status).toLowerCase() === "paid")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    });

    await loadPhoto(user.id);
    setLoading(false);
  }, [router, loadPhoto]);

  useEffect(() => {
    void loadDashboard();

    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  async function uploadPhoto(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please choose an image under 5 MB.");
      return;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setUploading(true);
    setMessage("");

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const path = `${user.id}/profile-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("partner-avatars")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      setMessage(`Upload failed: ${error.message}`);
    } else {
      await loadPhoto(user.id);
      setMessage("Your profile photo has been saved.");
    }

    setUploading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] text-sm text-slate-600">
        Loading PartnerHub...
      </main>
    );
  }

  const navigation = [
    { href: "/dashboard", label: "Overview", icon: "▦", active: true },
    { href: "/dashboard/referrals", label: "School referrals", icon: "▤", active: false },
    { href: "/dashboard/commissions", label: "Commissions & payouts", icon: "₦", active: false },
  ];

  return (
    <main data-theme={theme} className="min-h-screen bg-[#f5f6f8] text-[#202b3c]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[224px] shrink-0 flex-col bg-[#14213a] text-white md:flex">
          <Link href="/dashboard" className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d8b66a] text-sm font-black text-[#14213a]">
              C1
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-wide">CoreOne</span>
              <span className="mt-0.5 block text-[9px] font-semibold tracking-[2px] text-slate-400">
                PARTNERHUB
              </span>
            </span>
          </Link>

          <div className="px-3 pt-7">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-slate-500">
              Workspace
            </p>
            <nav className="space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[12px] font-medium transition ${
                    item.active
                      ? "bg-[#263653] text-[#f0d28d]"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[12px] font-semibold">Partner support</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Need help with your account? Contact CoreOne Partner Support.
              </p>
              <a
                href="tel:09045531092"
                className="mt-3 block break-words text-[11px] font-semibold text-[#f0d28d] underline underline-offset-2"
              >
                09045531092
              </a>
              <a
                href="mailto:core1enterprisesolutions@gmail.com"
                className="mt-2 block break-all text-[11px] text-slate-300 underline underline-offset-2"
              >
                core1enterprisesolutions@gmail.com
              </a>
            </div>
            <button
              onClick={signOut}
              className="mt-3 w-full rounded-lg px-3 py-2.5 text-left text-[12px] text-slate-300 hover:bg-white/5 hover:text-white"
            >
              ↗ &nbsp; Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14213a] text-xs font-black text-[#f0d28d] md:hidden">
                C1
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#26344b]">
                  Partner dashboard
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Your CoreOne representative workspace
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-[#c7a65e]"
              >
                <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
                <span className="ml-1.5 hidden sm:inline">{theme === "light" ? "Dark mode" : "Light mode"}</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
                aria-controls="partner-mobile-navigation"
                className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-lg text-[#192943] md:hidden"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileMenuOpen ? "×" : "☰"}
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-[11px] font-semibold text-slate-700">
                  {now ? formatDate(now) : "Nigeria time"}
                </p>
                <p className="mt-1 font-mono text-[12px] font-semibold text-[#a17a2f]">
                  {now ? formatTime(now) : "--:--:--"}
                </p>
              </div>
              <div className="h-8 border-l border-slate-200" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#e5d3a5] bg-[#f5edda] text-sm font-bold text-[#8d6a27]">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Your profile" className="h-full w-full object-cover" />
                  ) : (
                    name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="hidden max-w-[150px] sm:block">
                  <p className="truncate text-[12px] font-semibold">{name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Representative</p>
                </div>
              </div>
            </div>
          </header>

          {mobileMenuOpen && (
            <nav
              id="partner-mobile-navigation"
              aria-label="Mobile workspace navigation"
              className="space-y-1 border-b border-slate-200 bg-white p-3 shadow-sm md:hidden"
            >
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                    item.active
                      ? "bg-[#192943] text-[#f0d28d]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-6 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
              <div className="mt-2 border-t border-slate-100 px-3 pt-3">
                <p className="text-xs font-semibold text-slate-800">Partner Support</p>
                <a href="tel:09045531092" className="mt-2 block min-h-10 py-2 text-sm text-[#98732c] underline underline-offset-2">
                  Call 09045531092
                </a>
                <a href="mailto:core1enterprisesolutions@gmail.com" className="block break-all py-2 text-sm text-[#98732c] underline underline-offset-2">
                  core1enterprisesolutions@gmail.com
                </a>
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700"
                >
                  Sign out
                </button>
              </div>
            </nav>
          )}

          <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#9a762f]">
                  OVERVIEW
                </p>
                <h1 className="mt-2 text-[23px] font-semibold tracking-[-0.5px] text-[#192840] sm:text-[26px]">
                  Welcome back, {name.split(" ")[0]}
                </h1>
                <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                  Here is an overview of your CoreOne partnership.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-[#c7a65e] hover:bg-[#fffdf8]">
                <span className="text-base text-[#a17a2f]">＋</span>
                {uploading ? "Uploading..." : photo ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  className="hidden"
                  onChange={(event) => {
                    void uploadPhoto(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {message && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-600">
                {message}
              </div>
            )}

            <section className="mb-6 overflow-hidden rounded-xl bg-[#192943] text-white shadow-sm">
              <div className="grid md:grid-cols-[1fr_auto]">
                <div className="p-5 sm:p-6 lg:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[1.6px] text-[#e0c37e]">
                      PARTNER ACCOUNT
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      approved
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-amber-300/15 text-amber-200"
                    }`}>
                      {approved ? "● Approved" : `● ${status}`}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[17px] font-semibold sm:text-[19px]">
                    {approved
                      ? "Your partnership, all in one place."
                      : "Your application is being reviewed."}
                  </h2>
                  <p className="mt-2 max-w-[570px] text-[12px] leading-5 text-slate-300">
                    {approved
                      ? "Introduce schools to CoreOne, follow their onboarding progress, and keep track of your recorded commissions."
                      : "Your referral and commission tools become available when the administration team approves your account."}
                  </p>
                  {approved && (
                    <Link
                      href="/dashboard/referrals"
                      className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#dfbf75] px-3.5 py-2.5 text-[11px] font-bold text-[#17243b] transition hover:bg-[#eed49a]"
                    >
                      Submit a school <span>→</span>
                    </Link>
                  )}
                </div>
                <div className="flex min-w-[180px] flex-col justify-center border-t border-white/10 bg-white/[0.035] px-6 py-5 md:border-l md:border-t-0">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-slate-400">
                    Your organization
                  </p>
                  <p className="mt-2 break-words text-[13px] font-semibold">
                    {organization || "Not provided"}
                  </p>
                  <p className="mt-4 text-[10px] text-slate-400">
                    Registered email
                  </p>
                  <p className="mt-1 break-all text-[11px] text-slate-200">
                    {email}
                  </p>
                </div>
              </div>
            </section>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#26344b]">
                Partnership summary
              </h2>
              <span className="text-[10px] text-slate-500">Live account data</span>
            </div>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Schools referred",
                  value: String(stats.referrals),
                  note: "All your submitted referrals",
                  icon: "▤",
                  color: "text-blue-700 bg-blue-50",
                },
                {
                  label: "Schools onboarded",
                  value: String(stats.onboarded),
                  note: "Confirmed as onboarded",
                  icon: "✓",
                  color: "text-emerald-700 bg-emerald-50",
                },
                {
                  label: "Recorded commissions",
                  value: currency(stats.total),
                  note: "Commissions in your account",
                  icon: "₦",
                  color: "text-[#99752d] bg-[#fbf5e8]",
                },
                {
                  label: "Commissions paid",
                  value: currency(stats.paid),
                  note: "Marked as paid by CoreOne",
                  icon: "↗",
                  color: "text-violet-700 bg-violet-50",
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.025)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-slate-500">
                      {item.label}
                    </p>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${item.color}`}>
                      {item.icon}
                    </span>
                  </div>
                  <p className="mt-4 break-words text-[22px] font-semibold tracking-[-0.6px] text-[#1d2b42]">
                    {item.value}
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-500">{item.note}</p>
                </article>
              ))}
            </section>

            <div className="mb-3 mt-7">
              <h2 className="text-[14px] font-semibold text-[#26344b]">
                Your workspace
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Access the tools you use most.
              </p>
            </div>

            <section className="grid gap-3 lg:grid-cols-2">
              <Link
                href="/dashboard/referrals"
                onClick={(event) => {
                  if (!approved) event.preventDefault();
                }}
                className={`group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition ${
                  approved
                    ? "hover:border-[#d7bd7b] hover:shadow-sm"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf3fb] text-lg text-[#36577f]">
                  ▤
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#26344b]">
                    School referrals
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">
                    Submit a school, review referral details, and follow its progress through demo and onboarding.
                  </span>
                  <span className="mt-3 block text-[11px] font-semibold text-[#98732c]">
                    Manage referrals →
                  </span>
                </span>
              </Link>

              <Link
                href="/dashboard/commissions"
                onClick={(event) => {
                  if (!approved) event.preventDefault();
                }}
                className={`group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition ${
                  approved
                    ? "hover:border-[#d7bd7b] hover:shadow-sm"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fbf4e5] text-lg font-semibold text-[#98732c]">
                  ₦
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#26344b]">
                    Commissions & payouts
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">
                    Review recorded commissions, check payment statuses, and submit payout requests.
                  </span>
                  <span className="mt-3 block text-[11px] font-semibold text-[#98732c]">
                    View earnings →
                  </span>
                </span>
              </Link>
            </section>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-500">
              <span>© {new Date().getFullYear()} CoreOne PartnerHub</span>
              <span>Partner workspace · West Africa Time (WAT)</span>
            </footer>
          </div>
        </div>
      </div>
      <style jsx global>{`
        [data-theme="dark"] {
          background: #0b1220 !important;
          color: #e5e7eb !important;
          color-scheme: dark;
        }
        [data-theme="dark"] header,
        [data-theme="dark"] nav[aria-label="Mobile workspace navigation"],
        [data-theme="dark"] [class*="bg-white"] {
          background-color: #111c2e !important;
          border-color: #334155 !important;
        }
        [data-theme="dark"] [class*="text-[#192840]"],
        [data-theme="dark"] [class*="text-[#26344b]"],
        [data-theme="dark"] [class*="text-slate-700"],
        [data-theme="dark"] [class*="text-slate-800"],
        [data-theme="dark"] [class*="text-slate-600"] {
          color: #e2e8f0 !important;
        }
        [data-theme="dark"] [class*="border-slate-200"],
        [data-theme="dark"] [class*="border-slate-100"] {
          border-color: #334155 !important;
        }
        [data-theme="dark"] input,
        [data-theme="dark"] textarea,
        [data-theme="dark"] select {
          background-color: #0b1220 !important;
          border-color: #475569 !important;
          color: #f8fafc !important;
        }
        [data-theme="dark"] input::placeholder,
        [data-theme="dark"] textarea::placeholder {
          color: #94a3b8 !important;
        }
        @media (max-width: 767px) {
          [data-theme] {
            overflow-wrap: anywhere;
          }
          [data-theme] main,
          [data-theme] section {
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
