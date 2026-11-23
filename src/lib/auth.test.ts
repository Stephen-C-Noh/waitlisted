import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

type Row = { id: string; username: string; full_name: string; role: string; status: string; pin_hash: string | null };

const rows: Row[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: { users: { findFirst: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { verifyPinForFire, type StaffSession } from "./auth";

const findFirst = vi.mocked(prisma.users.findFirst);
const findMany = vi.mocked(prisma.users.findMany);

const user = (id: string, pin: string, status = "ACTIVE"): Row => ({
  id, username: id, full_name: `User ${id}`, role: "SERVER", status, pin_hash: bcrypt.hashSync(pin, 4),
});
const sessionOf = (id: string): StaffSession => ({
  userId: id, username: id, fullName: `User ${id}`, role: "SERVER",
});

beforeEach(() => {
  vi.clearAllMocks();
  rows.length = 0;
  rows.push(user("u1", "9012"), user("u2", "3456"), user("u3", "7890", "INACTIVE"));
  // Honors the id and status filters of the where clause, like the real table would.
  findFirst.mockImplementation((async ({ where }: { where: { id: string; status?: string } }) =>
    rows.find((r) => r.id === where.id && (where.status === undefined || r.status === where.status)) ?? null) as never);
});

describe("verifyPinForFire", () => {
  it("returns the session when the PIN is the logged-in user's own", async () => {
    expect(await verifyPinForFire("9012", sessionOf("u1"))).toEqual(sessionOf("u1"));
  });

  it("returns null when the PIN only matches a different active user", async () => {
    expect(await verifyPinForFire("3456", sessionOf("u1"))).toBeNull();
  });

  it("returns null for an inactive user with the correct PIN", async () => {
    expect(await verifyPinForFire("7890", sessionOf("u3"))).toBeNull();
  });
});
