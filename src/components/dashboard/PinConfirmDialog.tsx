"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";

interface Props {
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  loading: boolean;
  error?: string;
}

export function PinConfirmDialog({ onConfirm, onCancel, loading, error }: Props) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (value && index === 3 && next.every((d) => d !== "")) {
      onConfirm(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-surface-container-high rounded-xl p-8 w-full max-w-sm shadow-2xl ghost-border text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-headline text-2xl text-on-surface mb-2">
          PIN Verification
        </h3>
        <p className="text-on-surface-variant font-label text-sm mb-8">
          Enter your 4-digit staff PIN to authorize firing this order to the kitchen.
        </p>

        <div className="flex justify-center gap-4 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-14 text-center text-2xl font-headline bg-surface-container-lowest ghost-border rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ))}
        </div>

        {error && (
          <p className="text-error text-sm font-label mb-4">{error}</p>
        )}

        <div className="flex justify-center gap-4 mt-6">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            disabled={loading || digits.some((d) => !d)}
            onClick={() => onConfirm(digits.join(""))}
          >
            {loading ? "Verifying…" : "Confirm Fire"}
          </Button>
        </div>
      </div>
    </div>
  );
}
