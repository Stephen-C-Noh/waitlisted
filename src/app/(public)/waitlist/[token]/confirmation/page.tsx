import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { estimateWaitMinutes } from "@/lib/wait-time";
import { ConfirmationClient } from "./ConfirmationClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ConfirmationPage({ params }: Props) {
  const { token } = await params;

  const entry = await prisma.waitlist_entries.findUnique({
    where: { access_token: token },
    select: {
      id: true,
      guest_name: true,
      party_size: true,
      status: true,
      queue_position: true,
      estimated_wait_minutes: true,
      created_at: true,
    },
  });

  if (!entry) notFound();

  // Fresh estimate
  const estimate = await estimateWaitMinutes(entry.party_size);

  // Current position
  const currentPosition =
    (await prisma.waitlist_entries.count({
      where: {
        status: { in: ["WAITING", "NOTIFIED"] },
        created_at: { lt: entry.created_at },
      },
    })) + 1;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const menuUrl = `${baseUrl}/menu/${token}`;
  const statusUrl = `${baseUrl}/waitlist/${token}/status`;

  return (
    <ConfirmationClient
      guestName={entry.guest_name}
      partySize={entry.party_size}
      queuePosition={currentPosition}
      estimatedWait={estimate}
      menuUrl={menuUrl}
      statusUrl={statusUrl}
      token={token}
    />
  );
}
