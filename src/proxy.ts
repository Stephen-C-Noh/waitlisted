import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const STAFF_COOKIE = "staff-token";

// The proxy runs on the edge; it can't import from "@/lib/auth" because
// that module pulls in Prisma. We only need to verify the JWT signature
// and expiry here, not match it against the DB.
const secret = process.env.JWT_SECRET;
const key = secret ? new TextEncoder().encode(secret) : null;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Anyone can reach the login page.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (!key) {
    // Misconfigured deploy: refuse to grant access.
    const url = new URL("/admin/login", request.url);
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(STAFF_COOKIE)?.value;
  if (!token) {
    const url = new URL("/admin/login", request.url);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    const url = new URL("/admin/login", request.url);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
