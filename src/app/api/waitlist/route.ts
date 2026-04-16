import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CreateWaitlistEntryBody } from "@/lib/validations";
import { estimateWaitMinutes } from "@/lib/wait-time";
import { sendSms } from "@/lib/sms";
import { getStaffSession } from "@/lib/auth";

/** Staff-only: list waitlist entries with optional status/zone filters. */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status"); // e.g. "WAITING,NOTIFIED"
  const zone = searchParams.get("zone");

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = { in: status.split(",") };
  }
  if (zone) {
    where.preferred_zone = zone;
  }

  const entries = await prisma.waitlist_entries.findMany({
    where,
    orderBy: { created_at: "asc" },
    include: {
      pre_order: {
        select: { id: true, status: true, subtotal: true },
      },
    },
  });

  return NextResponse.json(entries);
}

/** Public: create a new waitlist entry. */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateWaitlistEntryBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { guestName, partySize, phoneNumber, notes, preferredZone } =
    parsed.data;

  // Generate a 64-hex access token
  const accessToken = crypto.randomBytes(32).toString("hex");

  // Calculate queue position (number of active entries + 1)
  const queuePosition =
    (await prisma.waitlist_entries.count({
      where: { status: { in: ["WAITING", "NOTIFIED"] } },
    })) + 1;

  // Calculate estimated wait
  const estimate = await estimateWaitMinutes(partySize);

  const entry = await prisma.waitlist_entries.create({
    data: {
      guest_name: guestName,
      party_size: partySize,
      phone_number: phoneNumber,
      notes: notes ?? null,
      preferred_zone: preferredZone ?? null,
      access_token: accessToken,
      queue_position: queuePosition,
      estimated_wait_minutes: estimate.minutes,
      status: "WAITING",
    },
  });

  // Console-stub SMS confirmation
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  await sendSms({
    to: phoneNumber,
    body:
      `Hi ${guestName}! You're #${queuePosition} on the Waitlisted list. ` +
      `Estimated wait: ${estimate.low}–${estimate.high} min. ` +
      `Track your status: ${baseUrl}/waitlist/${accessToken}/status`,
  });

  return NextResponse.json(
    {
      id: entry.id,
      accessToken,
      queuePosition,
      estimatedWait: { minutes: estimate.minutes, low: estimate.low, high: estimate.high },
    },
    { status: 201 },
  );
}
