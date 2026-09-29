import { NextResponse } from "next/server";

/** Liveness probe: always 200, no DB dependency. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
