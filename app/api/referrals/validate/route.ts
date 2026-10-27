import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import { isTrustedReferralRequest } from "@/src/lib/referrals/internal-auth";


export async function POST(request: NextRequest) {
  if (!isTrustedReferralRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code.trim().toUpperCase()
      : "";

  if (!code || code.length > 40) {
    return NextResponse.json(
      { valid: false, error: "A valid referral code is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase.rpc(
      "coreone_partnerhub_validate_referral_code",
      { supplied_code: code },
    );

    if (error) {
      console.error("Referral validation RPC failed:", error.message);
      return NextResponse.json(
        { error: "Referral validation is temporarily unavailable." },
        { status: 503 },
      );
    }

    const match = Array.isArray(data) ? data[0] : data;

    if (!match?.partner_id || !match?.referral_code) {
      return NextResponse.json({ valid: false, code });
    }

    return NextResponse.json({
      valid: true,
      code: match.referral_code,
    });
  } catch (error) {
    console.error(
      "Referral validation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Referral validation is temporarily unavailable." },
      { status: 503 },
    );
  }
}
