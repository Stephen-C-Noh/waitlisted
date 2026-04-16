import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface NavbarProps {
  /** Right-side content (badge, status text, etc.) */
  trailing?: ReactNode;
  /** Additional CSS classes on the outer header */
  className?: string;
}

export function Navbar({ trailing, className }: NavbarProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-surface/50 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex justify-between items-center w-full px-6 lg:px-8 py-4 lg:py-6 max-w-full mx-auto">
        <Link
          href="/slideshow"
          className="text-xl lg:text-2xl font-headline tracking-widest text-primary uppercase"
        >
          Waitlisted
        </Link>
        {trailing && <div className="flex items-center gap-4">{trailing}</div>}
      </div>
    </header>
  );
}
