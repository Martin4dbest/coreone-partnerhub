import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      feature: "representative-removal",
      status: "not_active",
      message:
        "Removal is not active. Database procedures, appeal handling, and secure server-side deletion must be configured before any account can be removed.",
    },
    { status: 200 }
  );
}
