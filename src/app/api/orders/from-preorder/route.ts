import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStaffSession, verifyPinForFire } from "@/lib/auth";
import { FirePreOrderBody } from "@/lib/validations";
import { createOrder, fireOrder, extractPosToken } from "@/lib/spring-boot-client";

/**
 * POST: fire a pre-order to the kitchen.
 * Requires staff session + a second PIN verification.
 * Calls Spring Boot POST /api/orders + POST /api/orders/{id}/fire.
 */
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = FirePreOrderBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Second PIN gate
  const fireAuth = await verifyPinForFire(parsed.data.pin);
  if (!fireAuth) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const preOrder = await prisma.pre_orders.findUnique({
    where: { id: parsed.data.preOrderId },
    include: {
      items: {
        select: {
          menu_item_id: true,
          quantity: true,
          special_instructions: true,
          unit_price: true,
        },
      },
      waitlist_entry: {
        select: { id: true, seated_table_id: true },
      },
    },
  });

  if (!preOrder) {
    return NextResponse.json({ error: "Pre-order not found" }, { status: 404 });
  }

  if (preOrder.status === "FIRED") {
    return NextResponse.json(
      { error: "This order has already been fired" },
      { status: 409 },
    );
  }

  if (preOrder.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: `Cannot fire a pre-order with status ${preOrder.status}` },
      { status: 409 },
    );
  }

  const tableId = preOrder.waitlist_entry.seated_table_id;
  const posToken = extractPosToken(request);

  let firedOrderId: string | null = null;

  // 1. Create order in Spring Boot
  const createRes = await createOrder(
    {
      tableId,
      userId: fireAuth.userId,
      items: preOrder.items.map((i) => ({
        menuItemId: i.menu_item_id,
        quantity: i.quantity,
        specialInstructions: i.special_instructions,
        unitPrice: Number(i.unit_price),
      })),
    },
    posToken,
  );

  if (createRes.ok) {
    firedOrderId = createRes.data.id;

    // 2. Fire the order
    await fireOrder(firedOrderId, posToken);
  } else {
    // POS unavailable — record fire locally
    firedOrderId = crypto.randomUUID();
  }

  // Update pre-order status
  const updated = await prisma.pre_orders.update({
    where: { id: preOrder.id },
    data: {
      status: "FIRED",
      fired_order_id: firedOrderId,
      fired_by_user_id: fireAuth.userId,
    },
  });

  return NextResponse.json({
    status: updated.status,
    firedOrderId,
    firedByUserId: fireAuth.userId,
  });
}
