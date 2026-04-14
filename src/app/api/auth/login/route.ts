import { NextResponse } from "next/server";
import { LoginBody } from "@/lib/validations";
import {
  findUserByPin,
  signStaffToken,
  STAFF_COOKIE,
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
  return response;
}
