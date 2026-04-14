import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassPanel({ className, children, ...rest }: GlassPanelProps) {
  return (
    <div className={cn("glass-panel p-6", className)} {...rest}>
      {children}
    </div>
  );
}
