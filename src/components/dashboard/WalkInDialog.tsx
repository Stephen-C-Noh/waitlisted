"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { POS_DISABLED_NOTE } from "@/lib/pos-mode";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: string | null;
}

interface Props {
  table: Table;
  posEnabled: boolean;
  onClose: () => void;
  onSeated: () => void;
}

export function WalkInDialog({ table, posEnabled, onClose, onSeated }: Props) {
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState(String(table.capacity));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSeat() {
    const size = Number(partySize);
    if (!guestName.trim()) {
      setError("Guest name is required");
      return;
    }
    if (!size || size < 1 || size > table.capacity) {
      setError(`Party size must be 1–${table.capacity}`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Create a waitlist entry and immediately seat it
      const createRes = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          partySize: size,
          phoneNumber: "+10000000000", // walk-in placeholder
          notes: "Walk-in",
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => null);
        setError(data?.error ?? "Failed to create entry");
        return;
      }

      const { id } = await createRes.json();

      // Seat immediately
      const seatRes = await fetch(`/api/waitlist/${id}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: table.id }),
      });

      if (!seatRes.ok) {
        const data = await seatRes.json().catch(() => null);
        setError(data?.error ?? "Failed to seat");
        return;
      }

      onSeated();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-high rounded-xl p-8 w-full max-w-sm shadow-2xl ghost-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-headline text-2xl text-on-surface mb-1">
          Seat Walk-in
        </h2>
        <p className="text-on-surface-variant font-label text-sm mb-6">
          {table.table_number} &middot; {table.zone} &middot; seats {table.capacity}
        </p>

        <div className="space-y-5">
          <Input
            id="walkin-name"
            label="Guest Name"
            placeholder="e.g. Smith"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            autoFocus
          />
          <Input
            id="walkin-party"
            label="Party Size"
            type="number"
            min={1}
            max={table.capacity}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
        </div>

        {!posEnabled && (
          <p className="mt-4 text-on-surface-variant text-sm font-label">
            {POS_DISABLED_NOTE}
          </p>
        )}

        {error && (
          <p className="mt-4 text-error text-sm font-label">{error}</p>
        )}

        <div className="flex justify-end gap-4 mt-8">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!posEnabled || submitting} onClick={handleSeat}>
            {submitting ? "Seating…" : "Seat Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
