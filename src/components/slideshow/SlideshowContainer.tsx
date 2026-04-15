"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { HeroSlide } from "./HeroSlide";
import { SlideIndicators } from "./SlideIndicators";
import { BentoSection } from "./BentoSection";
import { useIdleDetection } from "@/hooks/useIdleDetection";
import type { SlideshowItem } from "./types";

const AUTO_ADVANCE_MS = 8_000;

interface SlideshowContainerProps {
  items: SlideshowItem[];
}

export function SlideshowContainer({ items }: SlideshowContainerProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(id);
  }, [items.length]);

  useIdleDetection({
    onActivity: () => router.push("/waitlist"),
  });

  if (items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-8">
        <div className="glass-panel max-w-xl p-12 text-center">
          <h1 className="font-headline text-4xl text-on-surface">
            Welcome to Waitlisted
          </h1>
          <p className="mt-4 font-body text-on-surface-variant">
            No menu items to showcase yet.
          </p>
        </div>
      </main>
    );
  }

  const current = items[index];
  const bentoItems = items.filter((_, i) => i !== index).slice(0, 2);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push("/waitlist")}
      className="cursor-pointer"
    >
      <main className="relative h-screen w-full overflow-hidden bg-surface">
        <AnimatePresence mode="wait">
          <HeroSlide key={current.id} item={current} />
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center">
          <div className="pointer-events-auto">
            <SlideIndicators
              count={items.length}
              active={index}
              onSelect={setIndex}
            />
          </div>
        </div>
      </main>

      <BentoSection items={bentoItems} />
    </div>
  );
}
