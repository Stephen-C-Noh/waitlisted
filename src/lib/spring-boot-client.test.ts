import { describe, it, expect, vi, afterEach } from "vitest";
import { extractPosToken, updateTableStatus } from "@/lib/spring-boot-client";

describe("extractPosToken", () => {
  it("reads the pos-token cookie, keeping any '=' inside the JWT", () => {
    const request = new Request("http://localhost/api/x", {
      headers: { cookie: "staff-session=abc; pos-token=eyJh.b=c.d==; theme=dark" },
    });
    expect(extractPosToken(request)).toBe("eyJh.b=c.d==");
  });
});

describe("POS requests (via updateTableStatus)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns ok:false with status 0 and never calls fetch when POS integration is disabled", async () => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await updateTableStatus("t1", "CLEANING", "jwt");

    expect(res).toMatchObject({ ok: false, status: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:false with status 0 when the POS is unreachable (fetch rejects)", async () => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await updateTableStatus("t1", "CLEANING", "jwt");

    expect(fetchMock).toHaveBeenCalled();
    expect(res).toMatchObject({ ok: false, status: 0 });
  });
});
