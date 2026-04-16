import { NextResponse } from "next/server";
import { LoginBody } from "@/lib/validations";
import {
  findUserByPin,
  signStaffToken,
  STAFF_COOKIE,
  POS_COOKIE,
  staffCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LoginBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  const session = await findUserByPin(parsed.data.pin);
  if (!session) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = await signStaffToken(session);
  const response = NextResponse.json({ session });
  response.cookies.set(STAFF_COOKIE, token, staffCookieOptions);

  // Also authenticate with Spring Boot POS to get its JWT.
  // This token is needed for write operations (seat, fire order).
  const springUrl = process.env.SPRING_BOOT_URL ?? "http://localhost:8090";
  try {
    const posRes = await fetch(`${springUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: parsed.data.pin }),
    });

    if (posRes.ok) {
      const posData = (await posRes.json()) as { token: string };
      response.cookies.set(POS_COOKIE, posData.token, staffCookieOptions);
    } else {
      console.warn("[login] Spring Boot auth failed:", posRes.status);
    }
  } catch (err) {
    console.warn("[login] Spring Boot unreachable for auth:", err);
  }

  return response;
}
