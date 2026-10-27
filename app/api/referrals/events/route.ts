import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import { isTrustedReferralRequest } from "@/src/lib/referrals/internal-auth";


const ALLOWED_EVENTS = {
  coreone_school_app: "school_created",
  brainleague: "user_registered",
} as const;

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const code =
    typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  const product = input.product;
  const eventType = input.eventType;
  const externalEntityId =
    typeof input.externalEntityId === "string"
      ? input.externalEntityId.trim()
      : "";

  if (
    !code ||
    code.length > 40 ||
    typeof product !== "string" ||
    !(product in ALLOWED_EVENTS) ||
    eventType !== ALLOWED_EVENTS[product as keyof typeof ALLOWED_EVENTS] ||
    !externalEntityId ||
    externalEntityId.length > 200
  ) {
    return NextResponse.json(
      { error: "Invalid referral event details." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdmin();

    const { data: validationData, error: validationError } = await supabase.rpc(
      "coreone_partnerhub_validate_referral_code",
      { supplied_code: code },
    );

    if (validationError) {
      console.error("Referral event validation failed:", validationError.message);
      return NextResponse.json(
        { error: "Referral validation is temporarily unavailable." },
        { status: 503 },
      );
    }

    const match = Array.isArray(validationData)
      ? validationData[0]
      : validationData;

    if (!match?.partner_id || !match?.referral_code) {
      return NextResponse.json(
        { error: "Referral code is invalid or staff approval is inactive." },
        { status: 422 },
      );
    }

    const { error: insertError } = await supabase
      .from("coreone_partner_referral_events")
      .upsert(
        {
          partner_id: match.partner_id,
          referral_code: match.referral_code,
          product,
          event_type: eventType,
          external_entity_id: externalEntityId,
        },
        {
          onConflict: "product,event_type,external_entity_id",
          ignoreDuplicates: true,
        },
      );

    if (insertError) {
      console.error("Referral event insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Referral activity could not be recorded." },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Referral event recording failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Referral activity could not be recorded." },
      { status: 503 },
    );
  }
}
