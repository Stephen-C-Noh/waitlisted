import { describe, it, expect, beforeEach } from "vitest";
import { httpDuration, withMetrics } from "./metrics";
import { countFor } from "./metrics-test-utils";

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
