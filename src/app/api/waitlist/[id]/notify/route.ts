import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { sendSms, buildReadyNotification } from "@/lib/sms";

/** Staff action: notify guest that their table is almost ready. */
export async function POST(
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
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (entry.status !== "WAITING") {
    return NextResponse.json(
      { error: `Cannot notify entry with status ${entry.status}` },
      { status: 409 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  await sendSms({
    to: entry.phone_number,
    body: buildReadyNotification(
      entry.guest_name,
      baseUrl,
      entry.access_token,
    ),
  });

  const updated = await prisma.waitlist_entries.update({
    where: { id },
    data: {
      status: "NOTIFIED",
      notified_at: new Date(),
    },
  });

  return NextResponse.json(updated);
}
