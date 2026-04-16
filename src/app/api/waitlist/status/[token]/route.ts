import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessToken } from "@/lib/validations";
import { estimateWaitMinutes } from "@/lib/wait-time";

/** Public token-gated status endpoint for guests. */
export async function GET(
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
    select: {
      id: true,
      guest_name: true,
      party_size: true,
      status: true,
      queue_position: true,
      estimated_wait_minutes: true,
      preferred_zone: true,
      notified_at: true,
      seated_at: true,
      created_at: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Reject tokens for finished entries
  if (entry.status === "CANCELLED" || entry.status === "SEATED") {
    return NextResponse.json(
      { error: `This entry has been ${entry.status.toLowerCase()}` },
      { status: 410 },
    );
  }

  // Recalculate current position (how many active entries were created before this one)
  const currentPosition =
    (await prisma.waitlist_entries.count({
      where: {
        status: { in: ["WAITING", "NOTIFIED"] },
        created_at: { lt: entry.created_at },
      },
    })) + 1;

  // Fresh wait estimate
  const estimate = await estimateWaitMinutes(entry.party_size);

  return NextResponse.json({
    id: entry.id,
    guestName: entry.guest_name,
    partySize: entry.party_size,
    status: entry.status,
    queuePosition: currentPosition,
    estimatedWait: {
      minutes: estimate.minutes,
      low: estimate.low,
      high: estimate.high,
    },
    preferredZone: entry.preferred_zone,
    notifiedAt: entry.notified_at,
    createdAt: entry.created_at,
  });
}
