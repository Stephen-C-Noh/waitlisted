import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";

/** Staff: look up a pre-order by waitlist entry ID. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const preOrder = await prisma.pre_orders.findUnique({
    where: { waitlist_entry_id: id },
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
    return NextResponse.json({ error: "No pre-order found" }, { status: 404 });
  }

  // Enrich with menu item names
  const menuItemIds = preOrder.items.map((i) => i.menu_item_id);
  const menuItems = await prisma.menu_items.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(menuItems.map((m) => [m.id, m.name]));

  return NextResponse.json({
    id: preOrder.id,
    status: preOrder.status,
    subtotal: Number(preOrder.subtotal),
    firedOrderId: preOrder.fired_order_id,
    firedByUserId: preOrder.fired_by_user_id,
    items: preOrder.items.map((i) => ({
      id: i.id,
      menuItemId: i.menu_item_id,
      menuItemName: nameMap.get(i.menu_item_id) ?? "Unknown",
      quantity: i.quantity,
      specialInstructions: i.special_instructions,
      unitPrice: Number(i.unit_price),
    })),
  });
}
