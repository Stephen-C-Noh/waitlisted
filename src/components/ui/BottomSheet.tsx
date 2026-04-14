"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always-visible collapsed strip (e.g. cart count + total). Tapping it expands the sheet. */
  trigger: ReactNode;
  /** Content revealed when the sheet is expanded. */
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  children,
  className,
}: BottomSheetProps) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      ) : null}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl bg-surface-container-high shadow-[0_-12px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-[calc(100%-var(--trigger-h,72px))]",
          className,
        )}
        role="dialog"
        aria-modal={open}
      >
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          aria-expanded={open}
        >
          {trigger}
        </button>
        <div
          className={cn(
            "overflow-y-auto px-5 pb-6 transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
