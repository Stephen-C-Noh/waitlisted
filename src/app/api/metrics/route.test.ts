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
    expect((await scrape("Bearer s3cret extra")).status).toBe(401);
  });

  it("returns 200 with metrics for the right bearer token", async () => {
    vi.stubEnv("METRICS_TOKEN", "s3cret");

    const res = await scrape("Bearer s3cret");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("process_cpu");
  });

  it("accepts the bearer scheme in any case (RFC 7235)", async () => {
    vi.stubEnv("METRICS_TOKEN", "s3cret");

    expect((await scrape("bearer s3cret")).status).toBe(200);
    expect((await scrape("BEARER s3cret")).status).toBe(200);
  });

  it("ignores whitespace around the configured token (secret files end in a newline)", async () => {
    vi.stubEnv("METRICS_TOKEN", "s3cret\n");

    expect((await scrape("Bearer s3cret")).status).toBe(200);
  });
});

describe("GET /api/metrics without METRICS_TOKEN", () => {
  it("returns 404 in production (fail closed)", async () => {
    vi.stubEnv("METRICS_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");

    const res = await scrape();

    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("process_cpu");
  });

  it("stays open outside production (local dev, compose Prometheus)", async () => {
    vi.stubEnv("METRICS_TOKEN", "");
    vi.stubEnv("NODE_ENV", "development");

    const res = await scrape();

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("process_cpu");
  });
});
