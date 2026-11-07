import { NextResponse } from "next/server";

// Liveness only: no database or model calls, so it stays cheap and unauthenticated.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
