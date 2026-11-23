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

const SESSION = { userId: "u1", username: "mgr", fullName: "Mgr", role: "MANAGER" };

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
  vi.mocked(getStaffSession).mockResolvedValue(SESSION as never);
  vi.mocked(verifyPinForFire).mockResolvedValue(SESSION as never);
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

/** Route fetch by "METHOD path" to a canned status/body; records every call. */
function stubPos(routes: Record<string, { status: number; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method} ${new URL(url).pathname}`;
    const r = routes[key];
    if (!r) throw new Error(`unexpected fetch ${key}`);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const calls = (m: ReturnType<typeof stubPos>) =>
  m.mock.calls.map(([url, init]) => `${init?.method} ${new URL(url).pathname}`);

describe("POST /api/orders/from-preorder", () => {
  it("returns 503 and writes nothing when the POS is unreachable on create", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const res = await fire();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "POS unavailable" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 502, keeps the POS order id and does not mark FIRED when fire fails after create", async () => {
    stubPos({
      "POST /api/orders": { status: 201, body: { id: "pos-1" } },
      "POST /api/orders/pos-1/fire": { status: 500, body: {} },
    });

    const res = await fire();

    expect(res.status).toBe(502);
    expect(update).toHaveBeenCalledWith({
      where: { id: PRE_ORDER_ID },
      data: { fired_order_id: "pos-1" },
    });
    expect(update.mock.calls.some(([a]) => (a.data as { status?: string }).status === "FIRED")).toBe(false);
  });

  it("returns 502 and never fires when the POS create response has no order id", async () => {
    const m = stubPos({ "POST /api/orders": { status: 201, body: {} } });

    const res = await fire();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "POS returned no order id" });
    expect(calls(m)).toEqual(["POST /api/orders"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("retry with a saved fired_order_id skips create, fires that order, then marks FIRED", async () => {
    findUnique.mockResolvedValue(preOrder({ fired_order_id: "pos-1" }) as never);
    const fetchMock = stubPos({
      "POST /api/orders/pos-1/fire": { status: 200 },
    });

    const res = await fire();

    expect(res.status).toBe(200);
    expect(calls(fetchMock)).toEqual(["POST /api/orders/pos-1/fire"]);
    expect(update).toHaveBeenCalledWith({
      where: { id: PRE_ORDER_ID },
      data: { status: "FIRED", fired_by_user_id: "u1" },
    });
  });

  it("returns 409 and never calls the POS when the guest is not seated", async () => {
    findUnique.mockResolvedValue(
      preOrder({ waitlist_entry: { id: "w1", seated_table_id: null } }) as never,
    );
    const fetchMock = stubPos({});

    const res = await fire();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Guest is not seated" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates, fires, then marks FIRED and returns the POS order id", async () => {
    const fetchMock = stubPos({
      "POST /api/orders": { status: 201, body: { id: "pos-1" } },
      "POST /api/orders/pos-1/fire": { status: 200 },
    });

    const res = await fire();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "FIRED",
      firedOrderId: "pos-1",
      firedByUserId: "u1",
    });
    expect(calls(fetchMock)).toEqual(["POST /api/orders", "POST /api/orders/pos-1/fire"]);
    expect(update).toHaveBeenLastCalledWith({
      where: { id: PRE_ORDER_ID },
      data: { status: "FIRED", fired_by_user_id: "u1" },
    });
  });

  it("returns 409 and never calls the POS when the pre-order is already FIRED", async () => {
    findUnique.mockResolvedValue(preOrder({ status: "FIRED", fired_order_id: "pos-1" }) as never);
    const fetchMock = stubPos({});

    const res = await fire();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This order has already been fired" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 502 (never 401) when the POS rejects the token on create", async () => {
    stubPos({ "POST /api/orders": { status: 401, body: {} } });

    const res = await fire();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "POS session expired - sign out and back in",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 401 Invalid PIN and touches neither the POS nor the DB when the PIN is wrong", async () => {
    vi.mocked(verifyPinForFire).mockResolvedValue(null);
    const fetchMock = stubPos({});

    const res = await fire();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid PIN" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
