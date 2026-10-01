import { Registry, collectDefaultMetrics } from "@prometheus-io/client";

declare global {
    // eslint-disable-next-line no-var
    var __metricsRegistry: Registry | undefined;
}

function createRegistry(): Registry {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });
    return registry;
}

export const register: Registry = globalThis.__metricsRegistry ??= createRegistry();
