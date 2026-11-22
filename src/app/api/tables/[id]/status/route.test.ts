import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
import { PATCH } from "./route";

const TABLE_ID = "22222222-2222-2222-2222-222222222222";

const tableFind = vi.mocked(prisma.tables.findUnique);
const tableUpdate = vi.mocked(prisma.tables.update);

function setStatus(status: string) {
  return PATCH(
    new Request(`http://localhost/api/tables/${TABLE_ID}/status`, {
      method: "PATCH",
      headers: { cookie: "pos-token=jwt" },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: TABLE_ID }) },
  );
}

beforeEach(() => {
  vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getStaffSession).mockResolvedValue({
    userId: "u1", username: "host", fullName: "Host", role: "HOST",
  } as never);
  tableFind.mockResolvedValue({ id: TABLE_ID, table_number: "T1", status: "OCCUPIED" } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("PATCH /api/tables/[id]/status", () => {
  it("returns 503 and writes nothing when the POS is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const res = await setStatus("CLEANING");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "POS unavailable" });
    expect(tableUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 and never calls the POS on an invalid transition", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await setStatus("AVAILABLE");

    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tableUpdate).not.toHaveBeenCalled();
  });

  it("returns the re-read table after the POS accepts the change", async () => {
    tableFind
      .mockResolvedValueOnce({ id: TABLE_ID, table_number: "T1", status: "OCCUPIED" } as never)
      .mockResolvedValueOnce({ id: TABLE_ID, table_number: "T1", status: "CLEANING" } as never);
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await setStatus("CLEANING");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: TABLE_ID, status: "CLEANING" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(`${init.method} ${new URL(url).pathname}`).toBe(`PATCH /api/tables/${TABLE_ID}/status`);
    expect(tableUpdate).not.toHaveBeenCalled();
  });

  it("passes a POS rejection through and writes nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Table busy" }), { status: 409 })));

    const res = await setStatus("CLEANING");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Table busy" });
    expect(tableUpdate).not.toHaveBeenCalled();
  });
});
