"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui";

interface StatusData {
  id: string;
  guestName: string;
  partySize: number;
  status: string;
  queuePosition: number;
  estimatedWait: { minutes: number; low: number; high: number };
  preferredZone: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

function statusLabel(status: string) {
  switch (status) {
    case "WAITING":
      return { text: "Waiting", tone: "neutral" as const };
    case "NOTIFIED":
      return { text: "Your Table Is Almost Ready!", tone: "success" as const };
    default:
      return { text: status, tone: "neutral" as const };
  }
}

export default function StatusPage() {
  const { token } = useParams<{ token: string }>();

  const { data, error, isLoading } = useQuery<StatusData>({
    queryKey: ["waitlist-status", token],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/status/${token}`);
      if (res.status === 410) {
        const body = await res.json();
        throw new Error(body.error ?? "This entry is no longer active");
      }
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Error / gone state
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="font-headline text-3xl text-on-surface">
            Entry Unavailable
          </h1>
          <p className="font-body text-on-surface-variant">
            {error.message}
          </p>
        </div>
      </main>
    );
  }

  // Loading skeleton
  if (isLoading || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-lg space-y-6 animate-pulse">
          <div className="h-10 bg-surface-container-high rounded-lg w-3/4 mx-auto" />
          <div className="h-40 bg-surface-container-high rounded-xl" />
          <div className="h-40 bg-surface-container-high rounded-xl" />
        </div>
      </main>
    );
  }

  const { text: statusText, tone } = statusLabel(data.status);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/50 backdrop-blur-md">
        <div className="flex justify-between items-center w-full px-8 py-6 max-w-full mx-auto">
          <div className="text-2xl font-headline tracking-widest text-primary uppercase">
            Waitlisted
          </div>
          <Badge tone={tone} pulse={data.status === "NOTIFIED"}>
            {statusText}
          </Badge>
        </div>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center pt-24 pb-12 px-6">
        <div className="w-full max-w-lg space-y-8">
          {/* Greeting */}
          <div className="text-center space-y-2">
            <h1 className="font-headline text-4xl md:text-5xl text-on-surface">
              Hi, {data.guestName}
            </h1>
            <p className="font-body text-on-surface-variant">
              {data.status === "NOTIFIED"
                ? "Please make your way to the host stand."
                : "Hang tight — we're keeping your place."}
            </p>
          </div>

          {/* Position card */}
          <div className="bg-surface-container-high rounded-xl p-8 text-center ghost-border">
            <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase">
              Queue Position
            </span>
            <p className="font-headline text-7xl text-primary mt-2">
              #{data.queuePosition}
            </p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low rounded-lg p-5 border-l-2 border-primary/30">
              <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase block mb-1">
                Party Size
              </span>
              <span className="font-headline text-2xl text-on-surface">
                {data.partySize}
              </span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-5 border-l-2 border-tertiary/30">
              <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase block mb-1">
                Est. Wait
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-2xl text-on-surface">
                  {data.estimatedWait.low}–{data.estimatedWait.high}m
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
                </span>
              </div>
            </div>
          </div>

          {data.preferredZone && (
            <div className="bg-surface-container-low rounded-lg p-5 text-center">
              <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase block mb-1">
                Preferred Seating
              </span>
              <span className="font-headline text-xl text-on-surface">
                {data.preferredZone}
              </span>
            </div>
          )}

          {/* Auto-refresh note */}
          <p className="text-center font-label text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
            This page updates automatically every 10 seconds
          </p>
        </div>
      </main>

      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-tertiary/5 blur-[120px] rounded-full" />
      </div>
    </>
  );
}
