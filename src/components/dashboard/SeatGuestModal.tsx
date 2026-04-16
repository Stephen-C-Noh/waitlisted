"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Select } from "@/components/ui";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: string | null;
}

interface Entry {
  id: string;
  guest_name: string;
  party_size: number;
}

interface StaffUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

interface Props {
  entry: Entry;
  tables: Table[];
  onClose: () => void;
  onSeated: () => void;
}

export function SeatGuestModal({ entry, tables, onClose, onSeated }: Props) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [serverUserId, setServerUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch servers for assignment
  const { data: servers = [] } = useQuery<StaffUser[]>({
    queryKey: ["servers"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return [];
      // We don't have a dedicated users endpoint yet, so server selection
      // is optional — the SeatGuestBody schema makes serverUserId optional.
      return [];
    },
    enabled: false, // disabled until we have a users list endpoint
  });

  async function handleSeat() {
    if (!tableId) return;
    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, string> = { tableId };
      if (serverUserId) body.serverUserId = serverUserId;

      const res = await fetch(`/api/waitlist/${entry.id}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        className="bg-surface-container-high rounded-xl p-8 w-full max-w-md shadow-2xl ghost-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-headline text-2xl text-on-surface mb-2">
          Seat {entry.guest_name}
        </h2>
        <p className="text-on-surface-variant font-label text-sm mb-6">
          Party of {entry.party_size} — select an available table
        </p>

        <div className="space-y-6">
          {tables.length === 0 ? (
            <p className="text-error font-body text-sm">
              No available tables for this party size.
            </p>
          ) : (
            <Select
              id="seat-table"
              label="Table"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.table_number} — {t.zone} (seats {t.capacity})
                </option>
              ))}
            </Select>
          )}

          {servers.length > 0 && (
            <Select
              id="seat-server"
              label="Assign Server"
              value={serverUserId}
              onChange={(e) => setServerUserId(e.target.value)}
            >
              <option value="">No server assigned</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.role})
                </option>
              ))}
            </Select>
          )}
        </div>

        {error && (
          <p className="mt-4 text-error text-sm font-label">{error}</p>
        )}

        <div className="flex justify-end gap-4 mt-8">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!tableId || submitting || tables.length === 0}
            onClick={handleSeat}
          >
            {submitting ? "Seating…" : "Confirm Seat"}
          </Button>
        </div>
      </div>
    </div>
  );
}
