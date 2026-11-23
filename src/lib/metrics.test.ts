import { describe, it, expect, beforeEach } from "vitest";
import { httpDuration, withMetrics } from "./metrics";

/** Number of observations recorded for a route/status label pair. */
async function countFor(route: string, status: string) {
  const { values } = await httpDuration.get();
  return (
    values.find((v) => {
      const labels = v.labels as Record<string, string | number>;
      return (
        v.metricName === "http_request_duration_seconds_count" &&
        labels.route === route &&
        labels.status_code === status
      );
    })?.value ?? 0
  );
}

beforeEach(() => httpDuration.reset());

describe("withMetrics", () => {
  it("records the response status under the route label", async () => {
    const handler = withMetrics("/api/test", async () => new Response(null, { status: 404 }));

    await handler(new Request("http://localhost/api/test/123"), undefined);

    expect(await countFor("/api/test", "404")).toBe(1);
  });

  it("records 500 and rethrows when the handler throws", async () => {
    const boom = new Error("boom");
    const handler = withMetrics("/api/test", async () => {
      throw boom;
    });

    await expect(handler(new Request("http://localhost/api/test"), undefined)).rejects.toBe(boom);

    expect(await countFor("/api/test", "500")).toBe(1);
  });
});
