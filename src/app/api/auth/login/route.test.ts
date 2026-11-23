import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  findUserByPin: vi.fn(),
  signStaffToken: vi.fn(),
  STAFF_COOKIE: "staff-token",
  POS_COOKIE: "pos-token",
  staffCookieOptions: {},
}));

import { findUserByPin } from "@/lib/auth";
import { httpDuration } from "@/lib/metrics";
import { countFor } from "@/lib/metrics-test-utils";
import { POST } from "./route";

beforeEach(() => {
  httpDuration.reset();
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("records a wrong PIN as 401 under the route template", async () => {
    vi.mocked(findUserByPin).mockResolvedValue(null);

    await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin: "0000" }),
      }),
      undefined,
    );

    expect(await countFor("/api/auth/login", "401")).toBe(1);
  });
});
