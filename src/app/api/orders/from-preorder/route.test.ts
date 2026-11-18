import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { pre_orders: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  getStaffSession: vi.fn(),
  verifyPinForFire: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getStaffSession, verifyPinForFire } from "@/lib/auth";
import { POST } from "./route";

const PRE_ORDER_ID = "11111111-1111-1111-1111-111111111111";

const findUnique = vi.mocked(prisma.pre_orders.findUnique);
const update = vi.mocked(prisma.pre_orders.update);

function preOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: PRE_ORDER_ID,
    status: "CONFIRMED",
    fired_order_id: null,
    items: [
      { menu_item_id: "m1", quantity: 2, special_instructions: null, unit_price: 9.5 },
    ],
    waitlist_entry: { id: "w1", seated_table_id: "t1" },
    ...overrides,
  };
}

function fire() {
  return POST(
    new Request("http://localhost/api/orders/from-preorder", {
      method: "POST",
      headers: { cookie: "pos-token=jwt" },
      body: JSON.stringify({ preOrderId: PRE_ORDER_ID, pin: "1234" }),
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getStaffSession).mockResolvedValue({
    userId: "u0", username: "host", fullName: "Host", role: "HOST",
  } as never);
  vi.mocked(verifyPinForFire).mockResolvedValue({
    userId: "u1", username: "mgr", fullName: "Mgr", role: "MANAGER",
  } as never);
  findUnique.mockResolvedValue(preOrder() as never);
  update.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({
    status: data.status ?? "CONFIRMED",
  })) as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("POST /api/orders/from-preorder", () => {
  it("returns 503 and writes nothing when the POS is unreachable on create", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const res = await fire();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "POS unavailable" });
    expect(update).not.toHaveBeenCalled();
  });
});
