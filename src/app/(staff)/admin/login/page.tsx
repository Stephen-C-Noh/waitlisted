"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      if (!res.ok) {
        setError("Invalid PIN. Please try again.");
        setPin("");
        setBusy(false);
        return;
      }
      router.replace("/admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setPin("");
      setBusy(false);
    }
  }

  function handleDigit(d: string) {
    if (busy || pin.length >= PIN_LENGTH) return;
    setError(null);
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void submit(next);
    }
  }

  function handleBackspace() {
    if (busy) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  function handleClear() {
    if (busy) return;
    setError(null);
    setPin("");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="font-label text-xs uppercase tracking-[0.32em] text-primary">
            Waitlisted
          </p>
          <h1 className="font-headline text-4xl text-on-surface">
            Staff Access
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            Enter your 4-digit PIN to continue.
          </p>
        </header>

        <div
          className="flex items-center gap-4"
          aria-live="polite"
          aria-label={`PIN length ${pin.length} of ${PIN_LENGTH}`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-4 w-4 rounded-full transition-colors",
                i < pin.length
                  ? "bg-primary"
                  : "bg-surface-container-high ghost-border",
              )}
            />
          ))}
        </div>

        {error ? (
          <p role="alert" className="font-label text-sm text-error">
            {error}
          </p>
        ) : (
          <p className="font-label text-sm text-on-surface-variant/60 opacity-0">
            placeholder
          </p>
        )}

        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <KeypadButton key={k} onClick={() => handleDigit(k)} disabled={busy}>
              {k}
            </KeypadButton>
          ))}
          <KeypadButton onClick={handleClear} disabled={busy}>
            Clear
          </KeypadButton>
          <KeypadButton onClick={() => handleDigit("0")} disabled={busy}>
            0
          </KeypadButton>
          <KeypadButton onClick={handleBackspace} disabled={busy}>
            ←
          </KeypadButton>
        </div>
      </div>
    </main>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="aspect-square h-auto w-full rounded-xl px-0 font-headline text-2xl"
    >
      {children}
    </Button>
  );
}
