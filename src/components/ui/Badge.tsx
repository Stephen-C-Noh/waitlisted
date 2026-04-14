import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "error" | "vip";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  pulse?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label text-xs font-medium tracking-wide";

const tones: Record<Tone, string> = {
  neutral: "bg-secondary-container text-on-secondary-container",
  success: "bg-tertiary-container text-on-tertiary-container",
  warning: "bg-primary-container text-on-primary-container",
  error: "bg-error-container text-on-error-container",
  vip: "bg-primary-fixed text-on-primary-fixed",
};

const pulseDot: Record<Tone, string> = {
  neutral: "bg-on-secondary-container",
  success: "bg-on-tertiary-container",
  warning: "bg-on-primary-container",
  error: "bg-on-error-container",
  vip: "bg-on-primary-fixed",
};

export function Badge({
  tone = "neutral",
  pulse = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={cn(base, tones[tone], className)} {...rest}>
      {pulse ? (
        <span className="relative inline-flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              pulseDot[tone],
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              pulseDot[tone],
            )}
          />
        </span>
      ) : null}
      {children}
    </span>
  );
}
