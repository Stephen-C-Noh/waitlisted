/**
 * HTTP client for the Spring Boot POS backend.
 *
 * Write operations (table status, orders) go through Spring Boot so its
 * state machine, Kafka events, and WebSocket broadcasts fire correctly.
 * When the POS is unreachable or returns an auth error, callers can
 * fall back to local Prisma updates.
 */

const getBaseUrl = () =>
  process.env.SPRING_BOOT_URL ?? "http://localhost:8090";

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
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: buildHeaders(posToken),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[pos] ${method} ${path} failed: ${res.status}`,
        text,
      );
      return { ok: false, status: res.status, message: text };
    }

    const data = (await res.json().catch(() => null)) as T;
    return { ok: true, data };
  } catch (err) {
    console.error(`[pos] ${method} ${path} unreachable`, err);
    return { ok: false, status: 0, message: "Spring Boot unreachable" };
  }
}

/* ---------- domain methods ---------- */

/** PATCH /api/tables/{id}/status — update table status via POS state machine. */
export function updateTableStatus(
  tableId: string,
  status: string,
  posToken?: string,
) {
  return posRequest("PATCH", `/api/tables/${tableId}/status`, posToken, {
    status,
  });
}

/** POST /api/orders — create a DINE_IN order in the POS. */
export function createOrder(
  payload: {
    tableId: string | null;
    userId: string;
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
