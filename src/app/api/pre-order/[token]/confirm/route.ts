import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessToken } from "@/lib/validations";

/** POST: confirm a pre-order (DRAFT → CONFIRMED). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const valid = AccessToken.safeParse(token);
  if (!valid.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const entry = await prisma.waitlist_entries.findUnique({
    where: { access_token: token },
    select: { id: true, status: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (entry.status === "CANCELLED" || entry.status === "SEATED") {
    return NextResponse.json(
      { error: `This entry has been ${entry.status.toLowerCase()}` },
      { status: 410 },
    );
  }

  const preOrder = await prisma.pre_orders.findUnique({
    where: { waitlist_entry_id: entry.id },
    include: { items: true },
  });

  if (!preOrder) {
    return NextResponse.json(
      { error: "No pre-order exists for this entry" },
      { status: 404 },
    );
  }

  if (preOrder.status === "CONFIRMED") {
    return NextResponse.json({ status: "CONFIRMED", message: "Already confirmed" });
  }

  if (preOrder.status === "FIRED") {
    return NextResponse.json(
      { error: "This order has already been fired" },
      { status: 409 },
    );
  }

  if (preOrder.items.length === 0) {
    return NextResponse.json(
      { error: "Cannot confirm an empty pre-order" },
      { status: 400 },
    );
  }

  const updated = await prisma.pre_orders.update({
    where: { id: preOrder.id },
    data: { status: "CONFIRMED" },
  });

  return NextResponse.json({ status: updated.status });
}
