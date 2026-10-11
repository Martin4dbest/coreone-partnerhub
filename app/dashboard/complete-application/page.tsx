"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Application = {
  education_level: string | null;
  nysc_completed: boolean | null;
  age: number | null;
  gender: string | null;
};

export default function CompleteApplicationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [educationLevel, setEducationLevel] =
    useState<"undergraduate" | "graduate">("undergraduate");
  const [nyscCompleted, setNyscCompleted] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadApplication() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          router.replace("/login");
          return;
        }

        setEmail(user.email ?? "");

        const metadata = user.user_metadata ?? {};

        const { data, error: applicationError } = await supabase
          .from("coreone_partner_applications")
          .select(
            "education_level,nysc_completed,age,gender"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (applicationError) throw applicationError;

        const saved = (data as Application | null) ?? null;
        setApplication(saved);

        const education =
          saved?.education_level ?? metadata.education_level;

        if (education === "graduate" || education === "undergraduate") {
          setEducationLevel(education);
        }

        const nysc =
          saved?.nysc_completed ?? metadata.nysc_completed;

        if (typeof nysc === "boolean") {
          setNyscCompleted(nysc ? "yes" : "no");
        }

        const savedAge = saved?.age ?? metadata.age;
        if (savedAge !== null && savedAge !== undefined && savedAge !== "") {
          setAge(String(savedAge));
        }

        if (typeof (saved?.gender ?? metadata.gender) === "string") {
          setGender(String(saved?.gender ?? metadata.gender));
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your application. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadApplication();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d+$/.test(age) || Number(age) < 16 || Number(age) > 100) {
      setError("Enter an age between 16 and 100.");
      return;
    }

    if (!gender) {
      setError("Please select your gender.");
      return;
    }

    if (educationLevel === "graduate" && !nyscCompleted) {
      setError("Please indicate whether you have completed NYSC.");
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const user = authData.user;

      const { error: saveError } = await supabase
        .from("coreone_partner_applications")
        .upsert(
          {
            user_id: user.id,
            education_level: educationLevel,
            nysc_completed:
              educationLevel === "graduate"
                ? nyscCompleted === "yes"
                : null,
            age: Number(age),
            gender,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (saveError) throw saveError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          education_level: educationLevel,
          nysc_completed:
            educationLevel === "graduate"
              ? nyscCompleted === "yes"
              : null,
          age: Number(age),
          gender,
        },
      });

      setMessage(
        metadataError
          ? "Your application details were saved. Some profile details could not be synchronized."
          : "Your application details have been saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Submission failed: ${err.message}`
          : "Submission failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f5f9] p-4 text-xs text-slate-600">
        Loading your application...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f9] px-3 py-5 text-[12px] text-[#26344b] sm:px-5 sm:py-7">
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,33,58,0.07)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-7">
          <Link
            href="/dashboard"
            className="text-[11px] font-semibold text-slate-600 transition hover:text-[#b08a3e]"
          >
            ← Dashboard
          </Link>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#8d6a27]">
            Application
          </span>
        </div>

        <div className="border-b border-slate-100 bg-[#14213a] px-5 py-5 text-white sm:px-7">
          <p className="text-[9px] font-bold uppercase tracking-[2.5px] text-[#e2c77f]">
            CoreOne PartnerHub
          </p>
          <h1 style={{ fontSize: "14px", lineHeight: "1.4", fontWeight: 600 }} className="mt-1 tracking-tight text-white">
            Complete your application
          </h1>
          <p className="mt-1.5 break-all text-[11px] text-slate-300">{email}</p>
          <p className="mt-2 max-w-2xl text-[11px] leading-5 text-slate-300">
            Complete your personal and education details. Document uploads are not required. Your existing account and representative approval status will not be changed.
          </p>
        </div>

        {message && (
          <div
            role="status"
            className="mx-5 mt-4 rounded-md border border-green-200 bg-green-50 p-2.5 text-[11px] text-green-800 sm:mx-7"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700 sm:mx-7"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
          <label className="block text-[11px] font-semibold text-slate-700">
            Education level
            <select
              value={educationLevel}
              onChange={(event) =>
                setEducationLevel(
                  event.target.value as "undergraduate" | "graduate"
                )
              }
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px] font-normal text-slate-700 outline-none transition focus:border-[#b08a3e] focus:ring-2 focus:ring-[#b08a3e]/15"
              required
            >
              <option value="undergraduate">Undergraduate</option>
              <option value="graduate">Graduate</option>
            </select>
          </label>

          {educationLevel === "graduate" && (
            <label className="block text-[11px] font-semibold text-slate-700">
              Have you completed NYSC?
              <select
                value={nyscCompleted}
                onChange={(event) => setNyscCompleted(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px] font-normal text-slate-700 outline-none transition focus:border-[#b08a3e] focus:ring-2 focus:ring-[#b08a3e]/15"
                required
              >
                <option value="">Select an answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold text-slate-700">
              Age
              <input
                type="number"
                min="16"
                max="100"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-[11px] font-normal outline-none transition focus:border-[#b08a3e] focus:ring-2 focus:ring-[#b08a3e]/15"
                required
              />
            </label>

            <label className="block text-[11px] font-semibold text-slate-700">
              Gender
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px] font-normal text-slate-700 outline-none transition focus:border-[#b08a3e] focus:ring-2 focus:ring-[#b08a3e]/15"
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-[#14213a] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#233958] focus:outline-none focus:ring-2 focus:ring-[#b08a3e] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving application..." : "Save application details"}
          </button>
        </form>
      </section>
    </main>
  );
}
