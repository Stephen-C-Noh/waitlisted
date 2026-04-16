"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QRCode from "qrcode";
import { Button } from "@/components/ui";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerChildren, StaggerItem } from "@/components/motion/StaggerChildren";

interface WaitEstimate {
  minutes: number;
  low: number;
  high: number;
}

interface Props {
  guestName: string;
  partySize: number;
  queuePosition: number;
  estimatedWait: WaitEstimate;
  menuUrl: string;
  statusUrl: string;
  token: string;
}

export function ConfirmationClient({
  partySize,
  queuePosition: initialPosition,
  estimatedWait: initialEstimate,
  menuUrl,
  token,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Generate QR code on mount
  useEffect(() => {
    QRCode.toDataURL(menuUrl, {
      width: 224,
      margin: 2,
      color: { dark: "#131313", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [menuUrl]);

  // Poll wait estimate every 30s
  const { data: liveEstimate } = useQuery<WaitEstimate>({
    queryKey: ["wait-estimate", partySize],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/wait-estimate?partySize=${partySize}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
    initialData: initialEstimate,
  });

  // Poll position via token status endpoint
  const { data: statusData } = useQuery({
    queryKey: ["waitlist-status", token],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/status/${token}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const position = statusData?.queuePosition ?? initialPosition;
  const estimate = liveEstimate ?? initialEstimate;

  return (
    <>
      <Navbar
        trailing={
          <span className="text-on-surface-variant font-label text-xs tracking-widest uppercase">
            Status: Confirmed
          </span>
        }
      />

      <main className="min-h-screen flex flex-col items-center justify-center pt-24 pb-12 px-6">
        <StaggerChildren className="w-full max-w-2xl flex flex-col items-center text-center space-y-12">
          {/* Headline */}
          <StaggerItem className="space-y-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg
                className="w-7 h-7 text-tertiary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="font-label text-sm tracking-[0.3em] text-tertiary uppercase">
                Waitlist Confirmation
              </span>
            </div>
            <h1 className="font-headline text-5xl md:text-7xl text-on-surface leading-tight">
              You&rsquo;re on the list!
            </h1>
            <p className="font-body text-on-surface-variant text-lg max-w-md mx-auto opacity-80">
              We&rsquo;ve saved a place for you. We will notify you via text
              when your table is nearing readiness.
            </p>
          </StaggerItem>

          {/* QR code card */}
          <StaggerItem className="relative group">
            <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full opacity-50" />
            <div className="relative bg-surface-container-high p-8 rounded-xl shadow-2xl ghost-border flex flex-col items-center gap-6">
              <div className="bg-white p-4 rounded-lg shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Pre-order menu QR code"
                    className="w-48 h-48 md:w-56 md:h-56"
                  />
                ) : (
                  <div className="w-48 h-48 md:w-56 md:h-56 bg-surface-container-lowest animate-pulse rounded" />
                )}
              </div>
              <div className="max-w-[280px] space-y-2">
                <p className="font-headline text-primary text-xl tracking-tight">
                  Food &amp; Beverages Menu
                </p>
                <p className="font-label text-on-surface-variant text-xs leading-relaxed uppercase tracking-wider">
                  Scan to browse and pre-order from our menu while you wait.
                </p>
              </div>
            </div>
          </StaggerItem>

          {/* Bento summary cards */}
          <StaggerItem className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Party size */}
            <div className="bg-surface-container-low p-6 rounded-lg flex flex-col items-start justify-center border-l-2 border-primary/30">
              <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase mb-2">
                Reserved For
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-3xl text-on-surface">
                  Party of {partySize}
                </span>
              </div>
            </div>
            {/* Wait estimate */}
            <div className="bg-surface-container-low p-6 rounded-lg flex flex-col items-start justify-center border-l-2 border-tertiary/30">
              <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase mb-2">
                Current Est. Wait
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-3xl text-on-surface">
                  {estimate.low}–{estimate.high} min
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
                </span>
              </div>
            </div>
          </StaggerItem>

          {/* Queue position */}
          <StaggerItem className="bg-surface-container-low p-6 rounded-lg w-full text-center">
            <span className="font-label text-[10px] tracking-[0.2em] text-on-surface-variant uppercase">
              Your Position
            </span>
            <p className="font-headline text-5xl text-primary mt-2">
              #{position}
            </p>
          </StaggerItem>

          {/* Action buttons */}
          <StaggerItem className="flex flex-col sm:flex-row gap-6 w-full pt-4">
            <Link href={`/menu/${token}`} className="flex-1">
              <Button size="lg" className="w-full tracking-widest uppercase">
                Pre-Order Menu Items
              </Button>
            </Link>
            <Link href={`/waitlist/${token}/status`} className="flex-1">
              <Button
                variant="outline"
                size="lg"
                className="w-full tracking-widest uppercase"
              >
                Modify Reservation
              </Button>
            </Link>
          </StaggerItem>
        </StaggerChildren>
      </main>

      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-tertiary/5 blur-[120px] rounded-full" />
      </div>
    </>
  );
}
