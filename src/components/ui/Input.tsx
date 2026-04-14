import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

const fieldBase =
  "w-full rounded-lg bg-surface-container-lowest px-4 py-3 font-body text-on-surface placeholder:text-on-surface-variant/50 ghost-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50";

export function Input({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: InputProps) {
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
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldBase,
          error && "ring-2 ring-error/60 focus:ring-error",
          className,
        )}
        {...rest}
      />
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
