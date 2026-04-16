import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { updateTableStatus, extractPosToken } from "@/lib/spring-boot-client";

/**
 * Valid transitions:
 *   OCCUPIED  → CLEANING  (guest left, needs bussing)
 *   CLEANING  → AVAILABLE (table reset and ready)
 *   AVAILABLE → OCCUPIED  (handled by seat route, not here)
 *
 * Uses "CLEANING" to match the Postgres CHECK constraint on the tables table.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  OCCUPIED: ["CLEANING"],
  CLEANING: ["AVAILABLE"],
};

/** Staff: advance a table through its status lifecycle. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as { status?: string };
  if (!body.status || typeof body.status !== "string") {
    return NextResponse.json({ error: "Missing status field" }, { status: 400 });
  }

  const table = await prisma.tables.findUnique({ where: { id } });
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Enforce state machine
  const allowed = VALID_TRANSITIONS[table.status ?? ""] ?? [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      {
        error: `Cannot transition ${table.table_number} from ${table.status} to ${body.status}`,
      },
      { status: 409 },
    );
  }

  // Try Spring Boot first, fallback to local
  const posToken = extractPosToken(request);
  const posRes = await updateTableStatus(id, body.status, posToken);

  if (!posRes.ok) {
    await prisma.tables.update({
      where: { id },
      data: {
        status: body.status,
        current_server_id:
          body.status === "AVAILABLE" ? null : table.current_server_id,
      },
    });
  }

  const updated = await prisma.tables.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
