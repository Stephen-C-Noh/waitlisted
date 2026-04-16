import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { SeatGuestBody } from "@/lib/validations";

/**
 * Staff action: seat a guest.
 * Updates table status via Spring Boot and marks waitlist entry as SEATED.
 * Does NOT fire the pre-order — that is a separate action requiring a second PIN.
 */
export async function POST(
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

  const parsed = SeatGuestBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const entry = await prisma.waitlist_entries.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  if (entry.status !== "WAITING" && entry.status !== "NOTIFIED") {
    return NextResponse.json(
      { error: `Cannot seat entry with status ${entry.status}` },
      { status: 409 },
    );
  }

  const { tableId } = parsed.data;

  // Verify the table exists and is available
  const table = await prisma.tables.findUnique({ where: { id: tableId } });
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  if (table.status !== "AVAILABLE") {
    return NextResponse.json(
      { error: `Table ${table.table_number} is ${table.status}` },
      { status: 409 },
    );
  }

  // Update table status via Spring Boot POS
  const springUrl = process.env.SPRING_BOOT_URL ?? "http://localhost:8090";
  const posToken = request.headers.get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("pos-token="))
    ?.split("=")
    .slice(1)
    .join("=");

  try {
    const posRes = await fetch(
      `${springUrl}/api/tables/${tableId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(posToken ? { Authorization: `Bearer ${posToken}` } : {}),
        },
        body: JSON.stringify({ status: "OCCUPIED" }),
      },
    );

    if (!posRes.ok) {
      console.error(
        `[seat] Spring Boot table update failed: ${posRes.status}`,
        await posRes.text().catch(() => ""),
      );
      // Fallback: update locally if POS is unreachable (dev scenario)
      await prisma.tables.update({
        where: { id: tableId },
        data: { status: "OCCUPIED", current_server_id: session.userId },
      });
    }
  } catch (err) {
    console.error("[seat] Spring Boot unreachable, updating table locally", err);
    await prisma.tables.update({
      where: { id: tableId },
      data: { status: "OCCUPIED", current_server_id: session.userId },
    });
  }

  // Mark the waitlist entry as seated
  const updated = await prisma.waitlist_entries.update({
    where: { id },
    data: {
      status: "SEATED",
      seated_at: new Date(),
      seated_table_id: tableId,
      seated_by_user_id: session.userId,
    },
  });

  return NextResponse.json(updated);
}
