"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { POS_DISABLED_NOTE } from "@/lib/pos-mode";
import { TableFloorMap } from "./TableFloorMap";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: string | null;
  status: string | null;
}

interface Entry {
  id: string;
  guest_name: string;
  party_size: number;
  preferred_zone: string | null;
}

interface Props {
  entry: Entry;
  tables: Table[];
  posEnabled: boolean;
  onClose: () => void;
  onSeated: () => void;
}

export function SeatGuestModal({ entry, tables, posEnabled, onClose, onSeated }: Props) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const availableCount = tables.filter(
    (t) => t.status === "AVAILABLE" && t.capacity >= entry.party_size,
  ).length;

  async function handleSeat() {
    if (!selectedTableId) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/waitlist/${entry.id}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: selectedTableId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to seat guest");
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
        className="bg-surface-container-high rounded-xl p-8 w-full max-w-xl shadow-2xl ghost-border max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-headline text-2xl text-on-surface mb-1">
          Seat {entry.guest_name}
        </h2>
        <p className="text-on-surface-variant font-label text-sm mb-6">
          Party of {entry.party_size}
          {entry.preferred_zone && (
            <> &middot; Prefers <span className="text-primary">{entry.preferred_zone}</span></>
          )}
          {availableCount === 0 && (
            <span className="text-error"> &middot; No tables available</span>
          )}
        </p>

        <TableFloorMap
          mode="select"
          tables={tables}
          partySize={entry.party_size}
          preferredZone={entry.preferred_zone}
          selectedId={selectedTableId}
          onSelect={setSelectedTableId}
        />

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
          <Button
            disabled={!posEnabled || !selectedTableId || submitting || availableCount === 0}
            onClick={handleSeat}
          >
            {submitting ? "Seating…" : "Confirm Seat"}
          </Button>
        </div>
      </div>
    </div>
  );
}
