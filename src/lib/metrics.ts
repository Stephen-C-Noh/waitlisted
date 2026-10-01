import {
    Registry,
    collectDefaultMetrics,
    Histogram,
} from "@prometheus-io/client";

const NAME = "http_request_duration_seconds";
declare global {
    // eslint-disable-next-line no-var
    var __metricsRegistry: Registry | undefined;
}

function createRegistry(): Registry {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });
    return registry;
}

export const register: Registry = (globalThis.__metricsRegistry ??=
    createRegistry());
export const httpDuration =
    (register.getSingleMetric(NAME) as
        Histogram<"method" | "route" | "status_code"> | undefined) ??
    new Histogram({
        name: NAME,
        help: "HTTP Request Duration in Seconds",
        labelNames: ["method", "route", "status_code"],
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
        registers: [register],
    });

type Handler<Req extends Request, Ctx> = (req: Req, ctx: Ctx) => Promise<Response>;

export function withMetrics<Req extends Request, Ctx>(
    route: string,
    handler: Handler<Req, Ctx>,
): Handler<Req, Ctx> {
    return async (req, ctx) => {
        const start = performance.now();
        let status = 500;
        try {
            const response = await handler(req, ctx);
            status = response.status;
            return response;
        } finally {
            const seconds = (performance.now() - start) / 1000;
            httpDuration.labels(req.method, route, String(status)).observe(seconds);
        }
    };
}
