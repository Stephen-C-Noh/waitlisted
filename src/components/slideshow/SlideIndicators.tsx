"use client";

import { cn } from "@/lib/cn";

interface SlideIndicatorsProps {
  count: number;
  active: number;
  onSelect?: (index: number) => void;
}

export function SlideIndicators({
  count,
  active,
  onSelect,
}: SlideIndicatorsProps) {
  return (
    <div
      className="flex items-center gap-4"
      role="tablist"
      aria-label="Slide indicators"
    >
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Slide ${i + 1} of ${count}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(i);
            }}
            className={cn(
              "h-[2px] transition-all duration-500",
              isActive ? "w-12 bg-primary" : "w-8 bg-on-surface/20 hover:bg-on-surface/40",
            )}
          />
        );
      })}
    </div>
  );
}
