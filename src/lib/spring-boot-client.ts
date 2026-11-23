import { NextResponse } from "next/server";

/**
 * HTTP client for the Spring Boot POS backend.
 *
 * Write operations (table status, orders) go through Spring Boot so its
 * state machine, Kafka events, and WebSocket broadcasts fire correctly.
 * Failures come back as PosError. Every POS-writing route (fire, seat, table
 * status) turns them into HTTP responses with posFailure(). No route falls back to Prisma writes for POS
 * tables: if the POS call fails (including the 8 s timeout), nothing changes.
 */

const getBaseUrl = () =>
  process.env.SPRING_BOOT_URL ?? "http://localhost:8090";

/** False only in cloud mode (`POS_INTEGRATION_ENABLED=false`): no POS is reachable. */
export const isPosIntegrationEnabled = () =>
  process.env.POS_INTEGRATION_ENABLED !== "false";

/** Extract the pos-token cookie value from a raw Cookie header. */
export function extractPosToken(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("pos-token="))
    ?.split("=")
    .slice(1)
    .join("=");
}

function buildHeaders(posToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (posToken) headers["Authorization"] = `Bearer ${posToken}`;
  return headers;
}

export interface PosResult<T = unknown> {
  ok: true;
  data: T;
}

export interface PosError {
  ok: false;
  status: number;
  message: string;
}

type PosResponse<T = unknown> = PosResult<T> | PosError;

async function posRequest<T = unknown>(
  method: string,
  path: string,
  posToken?: string,
  body?: unknown,
): Promise<PosResponse<T>> {
  if (!isPosIntegrationEnabled()) {
    return { ok: false, status: 0, message: "POS integration disabled" };
  }
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: buildHeaders(posToken),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[pos] ${method} ${path} failed: ${res.status}`,
        text,
      );
      // Only a string `message` from the POS ErrorResponse; never raw HTML/JSON.
      let message = "";
      try {
        const m = JSON.parse(text).message;
        if (typeof m === "string") message = m;
      } catch {}
      return { ok: false, status: res.status, message };
    }

    const data = (await res.json().catch(() => null)) as T;
    return { ok: true, data };
  } catch (err) {
    console.error(`[pos] ${method} ${path} unreachable`, err);
    return { ok: false, status: 0, message: "Spring Boot unreachable" };
  }
}

/** Map a failed POS call to the HTTP response our own API should return. */
export function posFailure(res: PosError): NextResponse {
  if (res.status === 401 || res.status === 403) {
    return NextResponse.json(
      { error: "POS session expired - sign out and back in" },
      { status: 502 },
    );
  }
  if (res.status >= 400 && res.status < 500) {
    return NextResponse.json(
      { error: res.message || "POS rejected the request" },
      { status: res.status },
    );
  }
  if (res.status >= 500) {
    return NextResponse.json({ error: "POS error" }, { status: 502 });
  }
  return NextResponse.json({ error: "POS unavailable" }, { status: 503 });
}

/* ---------- domain methods ---------- */

/**
 * PATCH /api/tables/{id}/status — update table status via POS state machine.
 * The POS keeps serverId on OCCUPIED and clears it on CLEANING/AVAILABLE.
 */
export function updateTableStatus(
  tableId: string,
  status: string,
  posToken?: string,
  serverId?: string,
) {
  return posRequest("PATCH", `/api/tables/${tableId}/status`, posToken, {
    status,
    ...(serverId && { serverId }),
  });
}

/** POST /api/orders — create a DINE_IN order in the POS. */
export function createOrder(
  payload: {
    tableId: string;
    serverId: string;
    items: {
      menuItemId: string;
      quantity: number;
      specialInstructions: string | null;
      unitPrice: number;
    }[];
  },
  posToken?: string,
) {
  return posRequest<{ id: string }>("POST", "/api/orders", posToken, {
    ...payload,
    orderType: "DINE_IN",
  });
}

/** POST /api/orders/{id}/fire — fire an order to the kitchen. */
export function fireOrder(orderId: string, posToken?: string) {
  return posRequest("POST", `/api/orders/${orderId}/fire`, posToken, {});
}
