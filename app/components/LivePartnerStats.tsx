"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Metric = {
  label: string;
  count: number | null;
};

type Leader = {
  first_name: string;
  referral_count: number;
};

const chartColors = ["#D9A441", "#147D73", "#4778C7", "#8B5CF6", "#E8794A"];

export default function LivePartnerStats() {
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "Partner applications", count: null },
    { label: "School referrals", count: null },
  ]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderboardUnavailable, setLeaderboardUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCounts = useCallback(async () => {
    const [profiles, referrals, leaderboard] = await Promise.all([
      supabase
        .from("partner_profiles")
        .select("*", { count: "exact", head: true }),

      supabase.rpc("coreone_partnerhub_public_referral_count"),

      supabase.rpc("coreone_partnerhub_public_leaderboard"),
    ]);

    const referralCount =
      referrals.error || referrals.data == null
        ? null
        : Number(referrals.data);

    setMetrics([
      {
        label: "Partner applications",
        count: profiles.error ? null : profiles.count,
      },
      {
        label: "School referrals",
        count:
          referralCount !== null && Number.isFinite(referralCount)
            ? referralCount
            : null,
      },
    ]);

    if (leaderboard.error || !Array.isArray(leaderboard.data)) {
      setLeaderboardUnavailable(true);
      return;
    }

    const rows = (leaderboard.data as Leader[])
      .filter(
        (row) =>
          typeof row.first_name === "string" &&
          Number.isFinite(Number(row.referral_count)) &&
          Number(row.referral_count) > 0
      )
      .map((row) => ({
        first_name: row.first_name.trim().split(/\s+/)[0] || "Partner",
        referral_count: Number(row.referral_count),
      }))
      .sort((a, b) => b.referral_count - a.referral_count)
      .slice(0, 5);

    setLeaders(rows);
    setLeaderboardUnavailable(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (!active) return;
      await loadCounts();
    };

    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadCounts]);

  const totalTopFive = leaders.reduce(
    (total, leader) => total + leader.referral_count,
    0
  );
  const maximum = Math.max(1, ...leaders.map((leader) => leader.referral_count));

  let pieOffset = 0;
  const pieSegments = leaders.map((leader, index) => {
    const percentage =
      totalTopFive > 0 ? (leader.referral_count / totalTopFive) * 100 : 0;
    const segment = {
      ...leader,
      color: chartColors[index],
      percentage,
      offset: pieOffset,
    };
    pieOffset += percentage;
    return segment;
  });

  return (
    <section className="live-data-section" aria-labelledby="live-data-title">
      <div className="container">
        <div className="live-data-heading">
          <span className="eyebrow eyebrow-light">THE NETWORK</span>
          <h2 id="live-data-title">
            Real records. <span>Clear progress.</span>
          </h2>
          <p>
            PartnerHub network statistics and referral performance, based on
            recorded database activity.
          </p>
        </div>

        <div className="live-data-grid">
          {metrics.map((metric) => (
            <article className="live-data-card" key={metric.label}>
              <span className="live-data-label">{metric.label}</span>
              <strong className="live-data-number">
                {metric.count === null
                  ? "—"
                  : metric.count.toLocaleString("en-NG")}
              </strong>
              <span className="live-data-note">
                {metric.count === null
                  ? "Count currently unavailable"
                  : "Database count"}
              </span>
            </article>
          ))}
        </div>

        <div
          className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_15px_50px_rgba(16,37,61,0.07)]"
          aria-labelledby="leaderboard-title"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#10253d] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e6bd69]">
                Performance analytics
              </span>
              <h3 id="leaderboard-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
                Top 5 referral leaders
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Ranked by total recorded school referrals.
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Auto-refresh · 30 sec
            </div>
          </div>

          {leaderboardUnavailable ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-800">
                Leaderboard temporarily unavailable
              </p>
              <p className="mt-2 text-sm text-slate-500">
                The public leaderboard database function needs to be installed
                and accessible before rankings can be displayed.
              </p>
            </div>
          ) : leaders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No qualifying referrals have been recorded yet.
            </div>
          ) : (
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="min-w-0">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h4 className="font-bold text-[#10253d]">
                    Referral leaderboard
                  </h4>
                  <span className="text-xs text-slate-500">
                    {leaders.length} representatives
                  </span>
                </div>

                <div className="space-y-5">
                  {leaders.map((leader, index) => (
                    <div key={`${leader.first_name}-${index}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                              index === 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-bold text-slate-800">
                            {leader.first_name}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-[#10253d]">
                          {leader.referral_count.toLocaleString("en-NG")}
                          <span className="ml-1 text-xs font-medium text-slate-500">
                            {leader.referral_count === 1 ? "referral" : "referrals"}
                          </span>
                        </span>
                      </div>
                      <div
                        className="h-3 overflow-hidden rounded-full bg-slate-100"
                        role="img"
                        aria-label={`${leader.first_name}: ${leader.referral_count} referrals`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(leader.referral_count / maximum) * 100}%`,
                            backgroundColor: chartColors[index],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h4 className="text-center font-bold text-[#10253d]">
                  Top 5 referral share
                </h4>
                <p className="mt-1 text-center text-xs text-slate-500">
                  Share of referrals within this leaderboard
                </p>

                <div className="relative mx-auto mt-6 h-48 w-48 max-w-full">
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background:
                        totalTopFive > 0
                          ? `conic-gradient(${pieSegments
                              .map(
                                (segment) =>
                                  `${segment.color} ${segment.offset}% ${segment.offset + segment.percentage}%`
                              )
                              .join(", ")})`
                          : "#e2e8f0",
                    }}
                    role="img"
                    aria-label="Pie chart showing each top representative's share of the top five referrals"
                  />
                  <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
                    <strong className="text-3xl font-extrabold text-[#10253d]">
                      {totalTopFive.toLocaleString("en-NG")}
                    </strong>
                    <span className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Top 5 referrals
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {pieSegments.map((segment, index) => (
                    <div
                      key={`${segment.first_name}-${index}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="truncate font-semibold text-slate-700">
                          {segment.first_name}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-slate-800">
                        {segment.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <span>Only first names and aggregated referral counts are displayed.</span>
            <span>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-NG")}`
                : "Waiting for database data"}
            </span>
          </div>
        </div>

        <p className="live-data-disclaimer">
          Public figures are aggregated from recorded data. Individual school
          and contact records are not displayed.
        </p>
      </div>
    </section>
  );
}
