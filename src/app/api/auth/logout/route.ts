import { NextResponse } from "next/server";
import { POS_COOKIE, STAFF_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STAFF_COOKIE);
  response.cookies.delete(POS_COOKIE);
  return response;
}
