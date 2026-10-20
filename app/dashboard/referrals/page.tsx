"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Referral = {
  id: string;
  school_name: string;
  expected_students: number | null;
  expected_student_range: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string;
  state: string | null;
  notes: string | null;
  stage: string;
  created_at: string;
};

const stages = [
  { value: "submitted", label: "Referral submitted" },
  { value: "demo_scheduled", label: "Demo scheduled" },
  { value: "demo_completed", label: "Demo completed" },
  { value: "onboarding", label: "Onboarding in progress" },
  { value: "onboarded", label: "Successfully onboarded" },
  { value: "rejected", label: "Not proceeding" },
];

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/10";

export default function PartnerReferralsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [schoolName, setSchoolName] = useState("");
  const [expectedStudents, setExpectedStudents] = useState("1–50");
  const [customExpectedStudents, setCustomExpectedStudents] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const user = authData.user;

    const { data: profile, error: profileError } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError("We could not verify your partner account. Please try again.");
      setLoading(false);
      return;
    }

    const status = String(
      profile?.application_status ??
      profile?.approval_status ??
      profile?.status ??
      profile?.state ??
      "pending"
    ).toLowerCase();

    if (!["approved", "active"].includes(status)) {
      setApproved(false);
      setLoading(false);
      return;
    }

    setApproved(true);

    const { data, error: referralsError } = await supabase
      .from("coreone_partner_referrals")
      .select(
        "id, school_name, expected_students, expected_student_range, contact_name, contact_email, contact_phone, state, notes, stage, created_at"
      )
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false });

    if (referralsError) {
      setError(
        "Your account is approved, but referrals could not be loaded. Please check the database permissions."
      );
    } else {
      setReferrals((data ?? []) as Referral[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  async function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (expectedStudents === "Above 1,000") {
      const exactCount = Number(customExpectedStudents);
      if (!Number.isSafeInteger(exactCount) || exactCount <= 1000) {
        setError("For a school above 1,000 students, enter a whole number greater than 1,000.");
        return;
      }
    }

    if (!schoolName.trim() || !contactName.trim() || !contactPhone.trim()) {
      setError("Please complete the school name and contact details.");
      return;
    }

    setSubmitting(true);

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setSubmitting(false);
      router.replace("/login");
      return;
    }

    const user = authData.user;

    // Recheck approval before accepting a referral.
    const { data: profile, error: profileError } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const status = String(
      profile?.application_status ??
      profile?.approval_status ??
      profile?.status ??
      profile?.state ??
      "pending"
    ).toLowerCase();

    if (profileError || !["approved", "active"].includes(status)) {
      setError("Only approved sales partners can submit school referrals.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("coreone_partner_referrals")
      .insert({
        partner_id: user.id,
        school_name: schoolName.trim(),
        expected_student_range: expectedStudents,
        expected_students: expectedStudents === "Above 1,000"
          ? Number(customExpectedStudents)
          : null,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim(),
        state: state.trim() || null,
        notes: notes.trim() || null,
      });

    if (insertError) {
      setError(
        insertError.message.includes("coreone_partner_referrals")
          ? "The referral table could not be accessed. Please check that the Supabase SQL setup completed successfully."
          : `Referral submission failed: ${insertError.message}`
      );
      setSubmitting(false);
      return;
    }

    setSchoolName("");
    setExpectedStudents("1–50");
    setCustomExpectedStudents("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setState("");
    setNotes("");
    setSuccess("School referral submitted successfully.");
    setSubmitting(false);

    await loadReferrals();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f7fa] p-4 sm:p-6">
        <div className="mx-auto max-w-5xl animate-pulse rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading your partner workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fa] px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[12px] font-semibold text-teal-800 transition hover:text-teal-950"
        >
          ← Back to dashboard
        </Link>

        <header className="mb-6 mt-4 rounded-2xl bg-gradient-to-r from-[#10253d] via-[#15364b] to-[#17665f] px-5 py-6 text-white shadow-[0_12px_32px_rgba(16,37,61,0.12)] sm:px-7 sm:py-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200">
            CoreOne PartnerHub
          </p>
          <h1 className="mt-2 text-[25px] font-bold tracking-tight text-white sm:text-[29px]">
            School referrals
          </h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-5 text-slate-200 sm:text-[13px]">
            Introduce schools to CoreOne, submit their contact details and
            track each referral through demo and onboarding.
          </p>
        </header>

        {!approved ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-amber-950">
              Partner approval required
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-amber-900">
              Your partner account must be verified and approved by CoreOne
              before you can submit school referrals. Your current account
              has not been confirmed as approved.
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex text-[12px] font-semibold text-teal-800 hover:underline"
            >
              Return to dashboard →
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[0.94fr_1.06fr] xl:gap-6">
            <section className="h-fit rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_5px_22px_rgba(15,35,55,0.045)] sm:p-5 lg:p-6">
              <h2 className="text-[17px] font-bold tracking-tight text-[#172a40]">
                Submit a school
              </h2>
              <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                Provide accurate details for a school you are introducing
                to CoreOne.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800"
                >
                  {success}
                </div>
              )}

              <form onSubmit={submitReferral} className="mt-5 space-y-3.5">
                <div>
                  <label htmlFor="schoolName" className="text-[12px] font-semibold text-slate-700">
                    School name *
                  </label>
                  <input
                    id="schoolName"
                    className={inputClass}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Enter the school's full name"
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label htmlFor="expectedStudents" className="text-[12px] font-semibold text-slate-700">
                    Expected student population *
                  </label>
                  <select
                    id="expectedStudents"
                    className={inputClass}
                    value={expectedStudents}
                    onChange={(e) => setExpectedStudents(e.target.value)}
                    required
                  >
                    <option value="1–50">1–50 students</option>
                    <option value="51–100">51–100 students</option>
                    <option value="101–200">101–200 students</option>
                    <option value="201–300">201–300 students</option>
                    <option value="301–500">301–500 students</option>
                    <option value="501–1,000">501–1,000 students</option>
                    <option value="Above 1,000">Above 1,000 students</option>
                  </select>

                  {expectedStudents === "Above 1,000" && (
                    <div className="mt-3">
                      <label htmlFor="customExpectedStudents" className="text-[12px] font-semibold text-slate-700">
                        Exact number of students *
                      </label>
                      <input
                        id="customExpectedStudents"
                        type="number"
                        className={inputClass}
                        value={customExpectedStudents}
                        onChange={(e) => setCustomExpectedStudents(e.target.value)}
                        min={1001}
                        step={1}
                        required
                        placeholder="Enter a number above 1,000"
                      />
                    </div>
                  )}

                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Choose the closest range, or enter the exact number for a larger school.
                  </p>
                </div>

                <div>
                  <label htmlFor="contactName" className="text-[12px] font-semibold text-slate-700">
                    Contact person's name *
                  </label>
                  <input
                    id="contactName"
                    className={inputClass}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Proprietor, principal or decision-maker"
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label htmlFor="contactPhone" className="text-[12px] font-semibold text-slate-700">
                    Contact phone number *
                  </label>
                  <input
                    id="contactPhone"
                    type="tel"
                    className={inputClass}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="School contact phone number"
                    required
                    maxLength={40}
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="text-[12px] font-semibold text-slate-700">
                    Contact email
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    className={inputClass}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="name@school.com"
                    maxLength={254}
                  />
                </div>

                <div>
                  <label htmlFor="state" className="text-[12px] font-semibold text-slate-700">
                    State
                  </label>
                  <input
                    id="state"
                    className={inputClass}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Lagos"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="text-[12px] font-semibold text-slate-700">
                    Additional information
                  </label>
                  <textarea
                    id="notes"
                    className={inputClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional context about the school"
                    rows={4}
                    maxLength={2000}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#123b49] px-4 py-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#185b5a] focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit school referral"}
                </button>
              </form>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_3px_14px_rgba(15,35,55,0.025)]">
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight text-[#172a40]">
                    My referrals
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Your submitted schools and their current progress.
                  </p>
                </div>
                <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
                  {referrals.length} total
                </span>
              </div>

              {referrals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <h3 className="text-[13px] font-semibold text-slate-800">
                    No school referrals yet
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-slate-500">
                    Schools you submit will appear here so you can follow
                    their progress.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {referrals.map((referral) => {
                    const stage =
                      stages.find((item) => item.value === referral.stage)
                        ?.label ?? referral.stage;

                    return (
                      <article
                        key={referral.id}
                        className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_18px_rgba(15,35,55,0.035)] transition hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,35,55,0.06)] sm:p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-[14px] font-bold tracking-tight text-[#172a40]">
                              {referral.school_name}
                            </h3>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Contact: {referral.contact_name}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                            {stage}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-[11px] leading-5 text-slate-600">
                          <p>Phone: {referral.contact_phone}</p>
                          {referral.contact_email && (
                            <p>Email: {referral.contact_email}</p>
                          )}
                          {referral.state && <p>State: {referral.state}</p>}
                        </div>

                        {referral.notes && (
                          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
                            {referral.notes}
                          </p>
                        )}

                        <p className="mt-3 border-t border-slate-100 pt-2.5 text-[10px] text-slate-400">
                          Submitted{" "}
                          {new Date(referral.created_at).toLocaleDateString(
                            "en-NG",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
