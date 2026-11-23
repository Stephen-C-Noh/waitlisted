import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession, verifyPinForFire } from "@/lib/auth";
import { FirePreOrderBody } from "@/lib/validations";
import { withMetrics } from "@/lib/metrics";
import { createOrder, fireOrder, extractPosToken, posFailure } from "@/lib/spring-boot-client";

/**
 * POST: fire a pre-order to the kitchen.
 * Requires staff session + a second PIN verification (the session user's own PIN).
 * Calls Spring Boot POST /api/orders + POST /api/orders/{id}/fire.
 */
export const POST = withMetrics("/api/orders/from-preorder", async (request: Request) => {
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

  // Second PIN gate: only the logged-in user's own PIN passes
  const fireAuth = await verifyPinForFire(parsed.data.pin, session);
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
  if (!tableId) {
    return NextResponse.json({ error: "Guest is not seated" }, { status: 409 });
  }
  const posToken = extractPosToken(request);

  // 1. Create the order in Spring Boot (skipped on retry: id already saved)
  let firedOrderId = preOrder.fired_order_id;
  if (!firedOrderId) {
    const createRes = await createOrder(
      {
        tableId,
        serverId: session.userId,
        items: preOrder.items.map((i) => ({
          menuItemId: i.menu_item_id,
          quantity: i.quantity,
          specialInstructions: i.special_instructions,
        })),
      },
      posToken,
    );
    if (!createRes.ok) return posFailure(createRes);

    // Body can be null if it was unreadable (e.g. timeout mid-body); never fire `undefined`.
    if (!createRes.data?.id) {
      return NextResponse.json({ error: "POS returned no order id" }, { status: 502 });
    }
    firedOrderId = createRes.data.id;
    await prisma.pre_orders.update({
      where: { id: preOrder.id },
      // The creator is the POS order's serverId; save it now so a retry by
      // someone else cannot make fired_by_user_id disagree with the POS.
      data: { fired_order_id: firedOrderId, fired_by_user_id: session.userId },
    });
  }

  // Whoever created the POS order (older rows: whoever fires now).
  const firedByUserId = preOrder.fired_by_user_id ?? fireAuth.userId;

  // 2. Fire the order
  const fireRes = await fireOrder(firedOrderId, posToken);
  if (!fireRes.ok) return posFailure(fireRes);

  // Update pre-order status
  const updated = await prisma.pre_orders.update({
    where: { id: preOrder.id },
    data: {
      status: "FIRED",
      fired_by_user_id: firedByUserId,
    },
  });

  return NextResponse.json({
    status: updated.status,
    firedOrderId,
    firedByUserId,
  });
});
