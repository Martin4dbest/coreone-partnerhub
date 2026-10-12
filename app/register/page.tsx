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
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [educationLevel, setEducationLevel] = useState<"undergraduate" | "graduate">("undergraduate");
  const [nyscCompleted, setNyscCompleted] = useState("");
  const [age, setAge] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const [draftRestored, setDraftRestored] = useState(false);

  // Restore form details if the browser reloads.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("coreone-partner-registration-draft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (typeof draft.fullName === "string") setFullName(draft.fullName);
        if (typeof draft.phone === "string") setPhone(draft.phone);
        if (typeof draft.state === "string") setState(draft.state);
        if (typeof draft.city === "string") setCity(draft.city);
        if (typeof draft.address === "string") setAddress(draft.address);
        if (typeof draft.organization === "string") setOrganization(draft.organization);
        if (typeof draft.email === "string") setEmail(draft.email);
        if (draft.educationLevel === "undergraduate" || draft.educationLevel === "graduate") {
          setEducationLevel(draft.educationLevel);
        }
        if (typeof draft.nyscCompleted === "string") setNyscCompleted(draft.nyscCompleted);
        if (typeof draft.ageRange === "string") setAgeRange(draft.ageRange);
        if (typeof draft.gender === "string") setGender(draft.gender);
      }
    } catch (err) {
      console.warn("Could not restore registration details:", err);
    } finally {
      setDraftRestored(true);
    }
  }, []);

  // Save ordinary form details in this browser tab; never save passwords.
  useEffect(() => {
    if (!draftRestored || registrationComplete) return;

    sessionStorage.setItem(
      "coreone-partner-registration-draft",
      JSON.stringify({
        fullName,
        phone,
        state,
        city,
        address,
        organization,
        email,
        educationLevel,
        nyscCompleted,
        age,
        ageRange,
        gender,
      })
    );
  }, [
    draftRestored,
    registrationComplete,
    fullName,
    phone,
    state,
    city,
    address,
    organization,
    email,
    educationLevel,
    nyscCompleted,
    age,
    ageRange,
    gender,
  ]);


  useEffect(() => {
    if (!registrationComplete) return;
    const timeout = window.setTimeout(() => router.push("/login"), 8000);
    return () => window.clearTimeout(timeout);
  }, [registrationComplete, router]);

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
    if (!ageRange) {
      setError("Please select your age range.");
      return;
    }
    if (educationLevel === "graduate" && !nyscCompleted) {
      setError("Please indicate whether you have completed NYSC.");
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
            state: state.trim(),
            city: city.trim(),
            address: address.trim(),
            organization: organization.trim(),
            education_level: educationLevel,
            nysc_completed:
              educationLevel === "graduate" ? nyscCompleted === "yes" : null,
            age_range: ageRange,
            age: Number(ageRange === "41+" ? 41 : ageRange.split("-")[0]),
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
          "Your account has been created. Please confirm your email, then sign in to complete the saving of your application details. Your application remains subject to administrator approval."
        );
        setRegistrationComplete(true);
        return;
      }

      const { error: applicationError } = await supabase
        .from("coreone_partner_applications")
        .upsert({
          user_id: data.user.id,
          education_level: educationLevel,
          nysc_completed:
            educationLevel === "graduate" ? nyscCompleted === "yes" : null,
          age: Number(ageRange === "41+" ? 41 : ageRange.split("-")[0]),
          gender,
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

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">State
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={state} onChange={(e) => setState(e.target.value)} required autoComplete="address-level1" placeholder="Enter your state" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">City
                <input className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" placeholder="Enter your city" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700 sm:!col-span-2">Address
                <textarea className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={address} onChange={(e) => setAddress(e.target.value)} required autoComplete="street-address" rows={2} placeholder="Enter your residential address" />
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Organization
                <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={organization} onChange={(e) => setOrganization(e.target.value)} required>
                  <option value="">Select your organization</option>
                  <option value="CoreOne Enterprise Solutions">CoreOne Enterprise Solutions</option>
                </select>
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

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Age Range
                <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} required>
                  <option value="">Select your age range</option>
                  <option value="16-20">16–20 years</option>
                  <option value="21-25">21–25 years</option>
                  <option value="26-30">26–30 years</option>
                  <option value="31-35">31–35 years</option>
                  <option value="36-40">36–40 years</option>
                  <option value="41+">41 years and above</option>
                </select>
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Gender
                <select className="!mt-1.5 !block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !px-3 !py-2.5 !text-[12px] !font-normal !text-slate-800 !outline-none transition focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={gender} onChange={(e) => setGender(e.target.value)} required>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Password
                <span className="!relative !mt-1.5 !block"><input className="!block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !py-2.5 !pl-3 !pr-10 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="!absolute !inset-y-0 !right-0 !px-3 !text-slate-500 hover:!text-teal-700">{showPassword ? "🙈" : "👁"}</button></span>
              </label>

              <label className="!mb-0 !block !text-[12px] !font-semibold !leading-5 !text-slate-700">Confirm password
                <span className="!relative !mt-1.5 !block"><input className="!block !w-full !min-w-0 !rounded-lg !border !border-slate-200 !bg-slate-50/70 !py-2.5 !pl-3 !pr-10 !text-[12px] !font-normal !text-slate-800 !outline-none transition placeholder:!text-slate-400 focus:!border-teal-600 focus:!bg-white focus:!ring-2 focus:!ring-teal-600/10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} placeholder="Enter your password again" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="!absolute !inset-y-0 !right-0 !px-3 !text-slate-500 hover:!text-teal-700">{showConfirmPassword ? "🙈" : "👁"}</button></span>
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
