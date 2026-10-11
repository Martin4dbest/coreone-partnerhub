"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [educationLevel, setEducationLevel] = useState<"undergraduate" | "graduate">("undergraduate");
  const [nyscCompleted, setNyscCompleted] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [ssceDocument, setSsCEdocument] = useState<File | null>(null);
  const [degreeDocument, setDegreeDocument] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const [draftRestored, setDraftRestored] = useState(false);

  // Restore form details if the browser reloads while selecting a document.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("coreone-partner-registration-draft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (typeof draft.fullName === "string") setFullName(draft.fullName);
        if (typeof draft.phone === "string") setPhone(draft.phone);
        if (typeof draft.organization === "string") setOrganization(draft.organization);
        if (typeof draft.email === "string") setEmail(draft.email);
        if (draft.educationLevel === "undergraduate" || draft.educationLevel === "graduate") {
          setEducationLevel(draft.educationLevel);
        }
        if (typeof draft.nyscCompleted === "string") setNyscCompleted(draft.nyscCompleted);
        if (typeof draft.age === "string") setAge(draft.age);
        if (typeof draft.gender === "string") setGender(draft.gender);
      }
    } catch {
      sessionStorage.removeItem("coreone-partner-registration-draft");
    } finally {
      setDraftRestored(true);
    }
  }, []);

  // Save ordinary form details in this browser tab; never save passwords or files.
  useEffect(() => {
    if (!draftRestored || registrationComplete) return;

    sessionStorage.setItem(
      "coreone-partner-registration-draft",
      JSON.stringify({
        fullName,
        phone,
        organization,
        email,
        educationLevel,
        nyscCompleted,
        age,
        gender,
      })
    );
  }, [
    draftRestored,
    registrationComplete,
    fullName,
    phone,
    organization,
    email,
    educationLevel,
    nyscCompleted,
    age,
    gender,
  ]);

  useEffect(() => {
    if (!registrationComplete) return;
    const timeout = window.setTimeout(() => router.push("/login"), 5000);
    return () => window.clearTimeout(timeout);
  }, [registrationComplete, router]);

  function validateFile(file: File | null, label: string): string | null {
    if (!file) return `${label} is required.`;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${label} must be a PDF, JPG, or PNG file.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${label} must not exceed 10 MB.`;
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (!/^\d+$/.test(age) || Number(age) < 16 || Number(age) > 100) {
      setError("Enter an age between 16 and 100.");
      return;
    }
    if (educationLevel === "graduate" && !nyscCompleted) {
      setError("Please indicate whether you have completed NYSC.");
      return;
    }

    const fileError =
      validateFile(idDocument, "Means of identification") ||
      validateFile(ssceDocument, "SSCE certificate") ||
      (educationLevel === "graduate"
        ? validateFile(degreeDocument, "Degree certificate")
        : null);

    if (fileError) {
      setError(fileError);
      return;
    }

    setLoading(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            organization: organization.trim(),
            education_level: educationLevel,
            nysc_completed:
              educationLevel === "graduate" ? nyscCompleted === "yes" : null,
            age: Number(age),
            gender,
          },
        },
      });

      if (signupError) throw signupError;

      if (!data.user) {
        throw new Error("Supabase did not return an account. Please try again.");
      }

      if (!data.session) {
        setMessage(
          "Your account has been created, but your documents have NOT been uploaded yet. Please confirm your email, sign in, and complete document submission once that step is enabled. Your application is not complete."
        );
        setRegistrationComplete(true);
        return;
      }

      const userId = data.user.id;
      const bucket = "coreone-partner-documents";

      async function uploadDocument(file: File, kind: string): Promise<string> {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${kind}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: false, contentType: file.type });

        if (uploadError) throw uploadError;
        return path;
      }

      const idPath = await uploadDocument(idDocument!, "identification");
      const sscePath = await uploadDocument(ssceDocument!, "ssce");
      const degreePath =
        educationLevel === "graduate"
          ? await uploadDocument(degreeDocument!, "degree")
          : null;

      const { error: applicationError } = await supabase
        .from("coreone_partner_applications")
        .upsert({
          user_id: userId,
          education_level: educationLevel,
          nysc_completed:
            educationLevel === "graduate" ? nyscCompleted === "yes" : null,
          age: Number(age),
          gender,
          id_document_path: idPath,
          ssce_document_path: sscePath,
          degree_document_path: degreePath,
          updated_at: new Date().toISOString(),
        });

      if (applicationError) throw applicationError;

      setMessage(
        "Your account and application details have been submitted. Your documents were uploaded successfully. CoreOne will review your application before approval."
      );
      setRegistrationComplete(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page !min-h-screen !bg-[#f2f6f9] !px-3 !py-6 sm:!px-5 sm:!py-10">
      <section className="auth-card !mx-auto !w-full !max-w-3xl !rounded-2xl !border !border-slate-200 !bg-white !p-4 !shadow-[0_18px_55px_rgba(16,37,61,0.09)] sm:!p-7 lg:!p-9">
        <Link href="/" className="auth-back !text-[12px] !font-semibold !text-teal-800 hover:!text-teal-950">← Back to PartnerHub</Link>

        <div className="auth-heading !mb-6 !rounded-xl !bg-gradient-to-r !from-[#10253d] !via-[#153b4b] !to-[#17665f] !px-5 !py-6 !text-white sm:!px-7">
          <span className="auth-eyebrow !text-[10px] !font-bold !tracking-[0.18em] !text-teal-200">COREONE PARTNERHUB · JOIN OUR NETWORK</span>
          <h1 className="!mt-3 !text-[23px] !font-bold !leading-tight !tracking-tight !text-white sm:!text-[28px]" style={{ overflowWrap: "break-word" }}>
            Become a CoreOne representative
          </h1>
          <p className="!mt-2 !text-[12px] !leading-5 !text-slate-200">Create your representative account and submit your details for review.</p>
        </div>

        {error && <div className="auth-alert auth-error" role="alert">{error}</div>}
        {message && <div className="auth-alert auth-success" role="status">{message}</div>}

        {!registrationComplete && (
          <>
            <form onSubmit={handleSubmit} className="auth-form !grid !grid-cols-1 !gap-x-5 !gap-y-3.5 sm:!grid-cols-2">
              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Full name
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="Enter your full name" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Phone number
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" type="tel" placeholder="e.g. 08012345678" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Organization (optional)
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" placeholder="Company or organization" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Email address
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" type="email" placeholder="you@example.com" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Education level
                <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value as "undergraduate" | "graduate")} required>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                </select>
              </label>

              {educationLevel === "graduate" && (
                <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Have you completed NYSC?
                  <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={nyscCompleted} onChange={(e) => setNyscCompleted(e.target.value)} required>
                    <option value="">Select an option</option>
                    <option value="yes">Yes, completed</option>
                    <option value="no">No, not completed</option>
                  </select>
                </label>
              )}

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Age
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" type="number" min={16} max={100} value={age} onChange={(e) => setAge(e.target.value)} required placeholder="Enter your age" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Gender
                <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={gender} onChange={(e) => setGender(e.target.value)} required>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Means of identification (required)
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)} />
                <small className="!mt-1 !block !text-[10px] !font-normal !leading-4 !text-slate-500">PDF, JPG, or PNG; maximum 10 MB.</small>
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">SSCE certificate (required)
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(e) => setSsCEdocument(e.target.files?.[0] ?? null)} />
                <small className="!mt-1 !block !text-[10px] !font-normal !leading-4 !text-slate-500">PDF, JPG, or PNG; maximum 10 MB.</small>
              </label>

              {educationLevel === "graduate" && (
                <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Degree certificate (required for graduates)
                  <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(e) => setDegreeDocument(e.target.files?.[0] ?? null)} />
                  <small className="!mt-1 !block !text-[10px] !font-normal !leading-4 !text-slate-500">PDF, JPG, or PNG; maximum 10 MB.</small>
                </label>
              )}

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Password
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" type="password" placeholder="At least 8 characters" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Confirm password
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" type="password" placeholder="Enter your password again" />
              </label>

              <p className="auth-small sm:!col-span-2 !rounded-lg !border !border-teal-100 !bg-teal-50/70 !px-3 !py-3 !text-[11px] !leading-5 !text-slate-600">
                Your application is subject to CoreOne review. Documents are intended for private storage and must not be shared through public links.
              </p>

              <button className="auth-submit sm:!col-span-2 !w-full !rounded-lg !bg-[#123b49] !px-4 !py-3 !text-[12px] !font-bold !text-white !shadow-sm !transition hover:!bg-[#185b5a] disabled:!cursor-not-allowed disabled:!opacity-60" type="submit" disabled={loading}>
                {loading ? "Submitting application..." : "Create representative account"}
              </button>
            </form>

            <p className="auth-switch !mt-5 !text-center !text-[12px] !text-slate-500">Already registered? <Link href="/login">Sign in</Link></p>
          </>
        )}
      </section>
    </main>
  );
}
