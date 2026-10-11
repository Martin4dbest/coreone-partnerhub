"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Overview = {
  total_referrals: number | string;
  onboarded_schools: number | string;
  commission_earned: number | string;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

export default function HeroLiveOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    const { data: rows, error } = await supabase.rpc(
      "coreone_partnerhub_public_overview"
    );

    if (error || !Array.isArray(rows) || !rows[0]) {
      setUnavailable(true);
      return;
    }

    setData(rows[0] as Overview);
    setUnavailable(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const referrals = Number(data?.total_referrals ?? 0);
  const onboarded = Number(data?.onboarded_schools ?? 0);
  const commission = Number(data?.commission_earned ?? 0);
  const progress =
    referrals > 0 ? Math.min(100, (onboarded / referrals) * 100) : 0;

  return (
    <>
      <div className="panel-stats">
        <div className="panel-stat">
          <span>Schools onboarded</span>
          <strong>
            {data ? onboarded.toLocaleString("en-NG") : "—"}
          </strong>
          <small>
            <span className="stat-dot green" />
            {unavailable ? "Data unavailable" : "Live network total"}
          </small>
        </div>

        <div className="panel-stat">
          <span>Commission earned</span>
          <strong>{data ? money(commission) : "₦ —"}</strong>
          <small>
            <span className="stat-dot gold-dot" />
            Approved and paid NGN
          </small>
        </div>
      </div>

      <div className="chart-heading">
        <div>
          <strong>Partner activity</strong>
          <span>
            {unavailable ? "DATA UNAVAILABLE" : "LIVE DATABASE DATA"}
          </span>
        </div>
        <span className="chart-label">NETWORK</span>
      </div>

      <div
        className="chart-area"
        style={{ padding: "18px 4px", display: "grid", gap: "18px" }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            <span>School referrals</span>
            <strong>
              {data ? referrals.toLocaleString("en-NG") : "—"}
            </strong>
          </div>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "rgba(148,163,184,.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: referrals > 0 ? "100%" : "0%",
                height: "100%",
                background: "#147D73",
              }}
            />
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            <span>Successfully onboarded</span>
            <strong>
              {data
                ? `${onboarded.toLocaleString("en-NG")} (${progress.toFixed(0)}%)`
                : "—"}
            </strong>
          </div>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "rgba(148,163,184,.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: data ? `${progress}%` : "0%",
                height: "100%",
                background: "#D9A441",
                transition: "width .3s ease",
              }}
            />
          </div>
        </div>
      </div>

      <div className="chart-months">
        <span>REFERRALS</span>
        <span>ONBOARDING</span>
        <span>LIVE TOTALS</span>
      </div>
    </>
  );
}
