"use client";

import { usePathname, useRouter } from "next/navigation";
import { useIdleDetection } from "@/hooks/useIdleDetection";
import type { ReactNode } from "react";

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export default function PublicLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSlideshow = pathname === "/slideshow";

  useIdleDetection({
    // On /slideshow: any touch → /waitlist (handled by SlideshowContainer itself)
    // On other public pages: 2 min idle → /slideshow
    onIdle: isSlideshow ? undefined : () => router.replace("/slideshow"),
    idleTimeoutMs: isSlideshow ? undefined : IDLE_TIMEOUT_MS,
  });

  return <>{children}</>;
}
