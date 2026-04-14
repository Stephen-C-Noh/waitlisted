import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const STAFF_COOKIE = "staff-token";
export const POS_COOKIE = "pos-token";

const TOKEN_TTL = "24h";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

export type StaffRole = "ADMIN" | "MANAGER" | "SERVER";

export interface StaffSession {
  userId: string;
  username: string;
  fullName: string;
  role: StaffRole;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signStaffToken(session: StaffSession): Promise<string> {
  return new SignJWT({ ...session } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyStaffToken(
  token: string,
): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.fullName !== "string" ||
      (payload.role !== "ADMIN" &&
        payload.role !== "MANAGER" &&
        payload.role !== "SERVER")
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Iterates active non-KITCHEN users with a non-null pin_hash and returns
 * the first match for the given PIN. Uses bcryptjs.compare at cost 4, which
 * matches Spring Boot's BCryptPasswordEncoder(4).
 */
export async function findUserByPin(pin: string): Promise<StaffSession | null> {
  if (!/^\d{4}$/.test(pin)) return null;

  const candidates = await prisma.users.findMany({
    where: {
      status: "ACTIVE",
      pin_hash: { not: null },
      role: { not: "KITCHEN" },
    },
    select: {
      id: true,
      username: true,
      full_name: true,
      role: true,
      pin_hash: true,
    },
  });

  for (const user of candidates) {
    if (!user.pin_hash) continue;
    const ok = await bcrypt.compare(pin, user.pin_hash);
    if (ok) {
      return {
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role as StaffRole,
      };
    }
  }
  return null;
}

/**
 * Second PIN gate: verify that a given PIN matches the user who is making
 * the call. Used before firing a pre-order to the kitchen. Returns the
 * matched session so the caller can record `fired_by_user_id`.
 */
export async function verifyPinForFire(
  pin: string,
): Promise<StaffSession | null> {
  return findUserByPin(pin);
}

/**
 * Reads the staff-token cookie from the current request and returns the
 * decoded session, or null. For use in API routes and server components.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

/**
 * Cookie options shared by both staff-token and pos-token. HttpOnly blocks
 * JS access, SameSite=Strict blocks cross-site sends, Secure is flipped on
 * in production.
 */
export const staffCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TOKEN_TTL_SECONDS,
};
