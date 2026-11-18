import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Readiness probe: 200 only if the DB is actually reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not ready" }, { status: 503 });
  }
}
