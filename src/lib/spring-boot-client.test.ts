import { describe, it, expect, vi, afterEach } from "vitest";
import { extractPosToken, posFailure, updateTableStatus } from "@/lib/spring-boot-client";

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

  it("passes an 8 s timeout signal to fetch so a hung POS times out", async () => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
    // Node's AbortSignal.timeout ignores fake timers, so check the 8 s signal is the one fetch gets.
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateTableStatus("t1", "CLEANING", "jwt");

    expect(timeoutSpy).toHaveBeenCalledWith(8000);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(timeoutSpy.mock.results[0].value);
  });

  it("returns ok:false with status 0 when the timeout aborts the request", async () => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
    );

    const res = await updateTableStatus("t1", "CLEANING", "jwt");

    expect(res).toMatchObject({ ok: false, status: 0 });
  });

  it("reads the message field from a POS JSON error body", async () => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = {
      timestamp: "2026-11-18T00:00:00Z",
      status: 409,
      error: "Conflict",
      message: "Only DRAFT or SUBMITTED orders can be fired",
      path: "/api/orders/o1/fire",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 409 })));

    const res = await updateTableStatus("t1", "CLEANING", "jwt");

    expect(res).toEqual({ ok: false, status: 409, message: body.message });
  });

  it.each([
    ["an HTML page", "<html><body>404 Not Found</body></html>"],
    ["JSON without a message", JSON.stringify({ status: 404, error: "Not Found" })],
    ["JSON with a non-string message", JSON.stringify({ message: { code: 1 } })],
  ])("never uses the raw body as the message when the POS error is %s", async (_, text) => {
    vi.stubEnv("POS_INTEGRATION_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text, { status: 404 })));

    const res = await updateTableStatus("t1", "CLEANING", "jwt");

    expect(res).toEqual({ ok: false, status: 404, message: "" });
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

describe("posFailure", () => {
  it.each([401, 403])("maps POS %i to 502 (never 401) with a session-expired message", async (status) => {
    const res = posFailure({ ok: false, status, message: "" });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "POS session expired - sign out and back in",
    });
  });

  it.each([404, 409])("passes a POS %i through with the POS message", async (status) => {
    const res = posFailure({ ok: false, status, message: "table occupied" });

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: "table occupied" });
  });

  it("never passes an empty message through for a POS 4xx with no body", async () => {
    const res = posFailure({ ok: false, status: 400, message: "" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "POS rejected the request" });
  });

  it("maps a POS 500 to 502", async () => {
    const res = posFailure({ ok: false, status: 500, message: "boom" });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "POS error" });
  });
});
