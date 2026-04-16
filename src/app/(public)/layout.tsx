"use client";

import { usePathname, useRouter } from "next/navigation";
import { useIdleDetection } from "@/hooks/useIdleDetection";
import type { ReactNode } from "react";

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Pages accessed on the customer's phone (via QR scan) must NOT idle-redirect
 * to /slideshow — the customer has no way to recover their token URL.
 * Only kiosk-facing pages (waitlist form, confirmation) should idle-redirect.
 */
function isCustomerPhonePage(pathname: string): boolean {
  // /waitlist/{token}/status and /menu/{token} are phone pages
  return (
    /^\/waitlist\/[a-f0-9]+\/status/.test(pathname) ||
    /^\/menu\//.test(pathname)
  );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSlideshow = pathname === "/slideshow";
  const isPhonePage = isCustomerPhonePage(pathname);

  // Idle detection only on kiosk pages (not slideshow, not phone pages)
  const shouldIdle = !isSlideshow && !isPhonePage;

  useIdleDetection({
    onIdle: shouldIdle ? () => router.replace("/slideshow") : undefined,
    idleTimeoutMs: shouldIdle ? IDLE_TIMEOUT_MS : undefined,
  });

  return <>{children}</>;
}
