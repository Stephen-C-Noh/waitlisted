import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

function scrape(authorization?: string) {
  return GET(
    new Request("http://localhost/api/metrics", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("GET /api/metrics with METRICS_TOKEN set", () => {
  it("returns 401 and no metrics without an Authorization header", async () => {
    vi.stubEnv("METRICS_TOKEN", "s3cret");

    const res = await scrape();

    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("http_request_duration_seconds");
  });

  it("returns 401 for a wrong token of the same or a different length", async () => {
    vi.stubEnv("METRICS_TOKEN", "s3cret");

    expect((await scrape("Bearer wr0ng!")).status).toBe(401);
    expect((await scrape("Bearer s3cret-but-longer")).status).toBe(401);
    expect((await scrape("s3cret")).status).toBe(401);
  });
});
