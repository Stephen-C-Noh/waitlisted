import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

const fieldBase =
  "w-full appearance-none rounded-lg bg-surface-container-lowest px-4 py-3 pr-10 font-body text-on-surface ghost-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50";

// Inline SVG chevron as a CSS background so no extra elements are needed.
const chevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23d1c5b4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 1rem center",
};

export function Select({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...rest
}: SelectProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={id}
          className="font-label text-xs uppercase tracking-[0.18em] text-on-surface-variant"
        >
          {label}
        </label>
      ) : null}
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldBase,
          error && "ring-2 ring-error/60 focus:ring-error",
          className,
        )}
        style={chevronStyle}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="font-label text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="font-label text-xs text-on-surface-variant/80"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
