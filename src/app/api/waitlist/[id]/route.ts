import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { UpdateWaitlistEntryBody } from "@/lib/validations";

/** Staff-only: get a single waitlist entry by ID. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.waitlist_entries.findUnique({
    where: { id },
    include: {
      pre_order: {
        select: { id: true, status: true, subtotal: true },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}

/** Staff-only: update a waitlist entry (partial). */
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

  const parsed = UpdateWaitlistEntryBody.safeParse(raw);
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

  const data: Record<string, unknown> = {};
  if (parsed.data.guestName !== undefined) data.guest_name = parsed.data.guestName;
  if (parsed.data.partySize !== undefined) data.party_size = parsed.data.partySize;
  if (parsed.data.phoneNumber !== undefined) data.phone_number = parsed.data.phoneNumber;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.preferredZone !== undefined) data.preferred_zone = parsed.data.preferredZone;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  const updated = await prisma.waitlist_entries.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

/** Staff action: cancel / remove a waitlist entry. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.waitlist_entries.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (entry.status === "SEATED" || entry.status === "CANCELLED") {
    return NextResponse.json(
      { error: `Entry is already ${entry.status.toLowerCase()}` },
      { status: 409 },
    );
  }

  const updated = await prisma.waitlist_entries.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}
