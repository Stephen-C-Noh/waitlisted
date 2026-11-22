import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    waitlist_entries: { findUnique: vi.fn(), update: vi.fn() },
    tables: {
      findUnique: vi.fn(),
      update: vi.fn(() => {
        throw new Error("Prisma must not write tables");
      }),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ getStaffSession: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { POST } from "./route";

const ENTRY_ID = "11111111-1111-1111-1111-111111111111";
const TABLE_ID = "22222222-2222-2222-2222-222222222222";

const entryFind = vi.mocked(prisma.waitlist_entries.findUnique);
const entryUpdate = vi.mocked(prisma.waitlist_entries.update);
const tableFind = vi.mocked(prisma.tables.findUnique);
const tableUpdate = vi.mocked(prisma.tables.update);

function seat() {
  return POST(
    new Request(`http://localhost/api/waitlist/${ENTRY_ID}/seat`, {
      method: "POST",
      headers: { cookie: "pos-token=jwt" },
      body: JSON.stringify({ tableId: TABLE_ID }),
    }),
    { params: Promise.resolve({ id: ENTRY_ID }) },
  );
}

beforeEach(() => {
  vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getStaffSession).mockResolvedValue({
    userId: "u1", username: "host", fullName: "Host", role: "HOST",
  } as never);
  entryFind.mockResolvedValue({ id: ENTRY_ID, status: "WAITING" } as never);
  tableFind.mockResolvedValue({ id: TABLE_ID, table_number: "T1", status: "AVAILABLE" } as never);
  entryUpdate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({
    id: ENTRY_ID,
    ...data,
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

describe("POST /api/waitlist/[id]/seat", () => {
  it("returns 503 and changes nothing when the POS is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const res = await seat();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "POS unavailable" });
    expect(tableUpdate).not.toHaveBeenCalled();
    expect(entryUpdate).not.toHaveBeenCalled();
  });

  it("passes the POS 409 message through and leaves the entry unchanged", async () => {
    stubPos({
      [`PATCH /api/tables/${TABLE_ID}/status`]: {
        status: 409,
        body: { message: "Table T1 is already occupied" },
      },
    });

    const res = await seat();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Table T1 is already occupied" });
    expect(tableUpdate).not.toHaveBeenCalled();
    expect(entryUpdate).not.toHaveBeenCalled();
  });
});
