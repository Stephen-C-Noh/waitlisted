import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessToken, UpsertPreOrderBody } from "@/lib/validations";

/** Resolve waitlist entry from access token; rejects CANCELLED/SEATED. */
async function resolveEntry(token: string) {
  const valid = AccessToken.safeParse(token);
  if (!valid.success) return { error: "Invalid token", status: 400 } as const;

  const entry = await prisma.waitlist_entries.findUnique({
    where: { access_token: token },
    select: { id: true, status: true },
  });

  if (!entry) return { error: "Entry not found", status: 404 } as const;
  if (entry.status === "CANCELLED" || entry.status === "SEATED") {
    return {
      error: `This entry has been ${entry.status.toLowerCase()}`,
      status: 410,
    } as const;
  }

  return { entryId: entry.id } as const;
}

/** GET: load existing pre-order for this token (if any). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const resolved = await resolveEntry(token);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const preOrder = await prisma.pre_orders.findUnique({
    where: { waitlist_entry_id: resolved.entryId },
    include: {
      items: {
        select: {
          id: true,
          menu_item_id: true,
          quantity: true,
          special_instructions: true,
          unit_price: true,
        },
      },
    },
  });

  if (!preOrder) {
    return NextResponse.json({ preOrder: null });
  }

  return NextResponse.json({
    preOrder: {
      id: preOrder.id,
      status: preOrder.status,
      subtotal: Number(preOrder.subtotal),
      items: preOrder.items.map((i) => ({
        id: i.id,
        menuItemId: i.menu_item_id,
        quantity: i.quantity,
        specialInstructions: i.special_instructions,
        unitPrice: Number(i.unit_price),
      })),
    },
  });
}

/** POST: create or replace pre-order items (upsert). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const resolved = await resolveEntry(token);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpsertPreOrderBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Look up prices from the DB so clients can't forge them
  const menuItemIds = parsed.data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menu_items.findMany({
    where: { id: { in: menuItemIds }, active: true },
    select: { id: true, base_price: true },
  });

  const priceMap = new Map(menuItems.map((m) => [m.id, Number(m.base_price)]));

  // Validate all items exist
  for (const item of parsed.data.items) {
    if (!priceMap.has(item.menuItemId)) {
      return NextResponse.json(
        { error: `Menu item ${item.menuItemId} not found or inactive` },
        { status: 400 },
      );
    }
  }

  const subtotal = parsed.data.items.reduce(
    (sum, i) => sum + (priceMap.get(i.menuItemId) ?? 0) * i.quantity,
    0,
  );

  // Upsert pre-order
  const existing = await prisma.pre_orders.findUnique({
    where: { waitlist_entry_id: resolved.entryId },
  });

  if (existing) {
    // Don't allow changes to FIRED orders
    if (existing.status === "FIRED") {
      return NextResponse.json(
        { error: "This order has already been fired to the kitchen" },
        { status: 409 },
      );
    }

    // Delete old items, insert new ones
    await prisma.pre_order_items.deleteMany({
      where: { pre_order_id: existing.id },
    });

    await prisma.pre_order_items.createMany({
      data: parsed.data.items.map((i) => ({
        pre_order_id: existing.id,
        menu_item_id: i.menuItemId,
        quantity: i.quantity,
        special_instructions: i.specialInstructions ?? null,
        unit_price: priceMap.get(i.menuItemId)!,
      })),
    });

    const updated = await prisma.pre_orders.update({
      where: { id: existing.id },
      data: { subtotal, status: "DRAFT" },
    });

    return NextResponse.json({ preOrderId: updated.id, subtotal });
  }

  // Create new
  const preOrder = await prisma.pre_orders.create({
    data: {
      waitlist_entry_id: resolved.entryId,
      subtotal,
      status: "DRAFT",
      items: {
        create: parsed.data.items.map((i) => ({
          menu_item_id: i.menuItemId,
          quantity: i.quantity,
          special_instructions: i.specialInstructions ?? null,
          unit_price: priceMap.get(i.menuItemId)!,
        })),
      },
    },
  });

  return NextResponse.json(
    { preOrderId: preOrder.id, subtotal },
    { status: 201 },
  );
}
