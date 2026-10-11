import { NextResponse } from "next/server";

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
