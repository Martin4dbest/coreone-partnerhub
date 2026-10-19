"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Proposal = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type Decision = {
  id: string;
  proposal_id: string;
  user_id: string;
  decision: "accepted" | "rejected";
  responded_at: string;
};

function dateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export default function RepresentativeProposalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

      const userId = authData.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("partner_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const profileRow = (profile ?? {}) as Record<string, unknown>;

      const status = String(
        profileRow.application_status ??
          profileRow.approval_status ??
          profileRow.status ??
          profileRow.state ??
          "pending"
      )
        .trim()
        .toLowerCase();

      const isApproved = ["approved", "active"].includes(status);

      setApproved(isApproved);

      if (!isApproved) {
        setProposals([]);
        setDecisions({});
        return;
      }

      const [
        { data: proposalData, error: proposalError },
        { data: responseData, error: responseError },
      ] = await Promise.all([
        supabase
          .from("coreone_partnerhub_proposals")
          .select("*")
          .eq("published", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("coreone_partnerhub_proposal_responses")
          .select("*")
          .eq("user_id", userId),
      ]);

      if (proposalError) throw proposalError;
      if (responseError) throw responseError;

      setProposals((proposalData ?? []) as Proposal[]);

      const decisionMap: Record<string, Decision> = {};

      for (const row of (responseData ?? []) as Decision[]) {
        decisionMap[row.proposal_id] = row;
      }

      setDecisions(decisionMap);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load proposals. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function respond(
    proposal: Proposal,
    decision: "accepted" | "rejected"
  ) {
    if (!approved) {
      setError("Only approved or active representatives may respond.");
      return;
    }

    const action = decision === "accepted" ? "accept" : "reject";

    if (
      !window.confirm(
        `Confirm that you want to ${action} "${proposal.title}"?`
      )
    ) {
      return;
    }

    setWorkingId(proposal.id);
    setError("");
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { error: responseError } = await supabase
        .from("coreone_partnerhub_proposal_responses")
        .upsert(
          {
            proposal_id: proposal.id,
            user_id: authData.user.id,
            decision,
            responded_at: new Date().toISOString(),
          },
          {
            onConflict: "proposal_id,user_id",
          }
        );

      if (responseError) throw responseError;

      setMessage(
        decision === "accepted"
          ? "Your acceptance has been recorded."
          : "Your rejection has been recorded."
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your response. Please try again."
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[#98732c] hover:underline"
        >
          ← Back to your dashboard
        </Link>

        <header className="mt-5 rounded-2xl bg-[#192840] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#dfbf75]">
            CoreOne PartnerHub
          </p>

          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Partnership proposals
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Review proposals published by CoreOne and record your decision.
            Your response will be available to the administration team.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {message}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-sm text-slate-500">
            Loading proposals...
          </p>
        ) : !approved ? (
          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-900">
              Approval required
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-900">
              Proposal responses are available only to approved or active
              representatives. Your account approval status is not changed
              by submitting a response.
            </p>
          </section>
        ) : proposals.length === 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">No published proposals yet</h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              There are currently no published proposals available for
              review. Please check again later.
            </p>
          </section>
        ) : (
          <section className="mt-6 space-y-5">
            {proposals.map((proposal) => {
              const response = decisions[proposal.id];
              const isWorking = workingId === proposal.id;

              return (
                <article
                  key={proposal.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#98732c]">
                        Official proposal
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-[#192840]">
                        {proposal.title}
                      </h2>
                    </div>

                    {response && (
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          response.decision === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {response.decision === "accepted"
                          ? "You accepted"
                          : "You rejected"}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {proposal.body}
                  </div>

                  <p className="mt-5 text-xs text-slate-500">
                    Last updated{" "}
                    {dateLabel(proposal.updated_at || proposal.created_at)}
                  </p>

                  {response && (
                    <p className="mt-2 text-xs text-slate-500">
                      Your last response:{" "}
                      {dateLabel(response.responded_at)}
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => void respond(proposal, "accepted")}
                      className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWorking
                        ? "Saving..."
                        : response?.decision === "accepted"
                          ? "Accept again"
                          : "Accept proposal"}
                    </button>

                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => void respond(proposal, "rejected")}
                      className="rounded-lg border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWorking
                        ? "Saving..."
                        : response?.decision === "rejected"
                          ? "Reject again"
                          : "Reject proposal"}
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    You may change your decision later. Your latest response
                    will be recorded and shown to the administrator.
                  </p>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
