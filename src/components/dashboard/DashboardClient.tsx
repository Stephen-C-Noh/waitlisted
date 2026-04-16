"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui";
import { SeatGuestModal } from "./SeatGuestModal";
import { PreOrderModal } from "./PreOrderModal";
import { TableFloorMap } from "./TableFloorMap";
import { WalkInDialog } from "./WalkInDialog";

/* ---------- types ---------- */

interface WaitlistEntry {
  id: string;
  guest_name: string;
  party_size: number;
  phone_number: string;
  notes: string | null;
  status: string;
  queue_position: number | null;
  estimated_wait_minutes: number | null;
  preferred_zone: string | null;
  notified_at: string | null;
  seated_at: string | null;
  created_at: string;
  pre_order: { id: string; status: string; subtotal: string } | null;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: string | null;
  status: string | null;
}

type Tab = "active" | "seated" | "cancelled";
type Zone = "" | "Main Dining" | "Patio" | "Bar";

const TAB_STATUS: Record<Tab, string> = {
  active: "WAITING,NOTIFIED",
  seated: "SEATED",
  cancelled: "CANCELLED,NO_SHOW",
};

/* ---------- helpers ---------- */

function waitChip(entry: WaitlistEntry) {
  if (!entry.estimated_wait_minutes) return null;
  const elapsed = Math.floor(
    (Date.now() - new Date(entry.created_at).getTime()) / 60_000,
  );
  const remaining = entry.estimated_wait_minutes - elapsed;

  if (remaining <= 5)
    return { text: "Ready Soon", color: "text-tertiary" as const, ping: true };
  if (remaining < 0)
    return { text: "Delayed", color: "text-error" as const, ping: false };
  return { text: "On Track", color: "text-tertiary" as const, ping: false };
}

function matchingTables(tables: Table[], entry: WaitlistEntry) {
  return tables
    .filter(
      (t) =>
        t.capacity >= entry.party_size &&
        t.status === "AVAILABLE" &&
        (!entry.preferred_zone || t.zone === entry.preferred_zone),
    )
    .map((t) => t.table_number);
}

/* ---------- component ---------- */

interface Props {
  staffName: string;
  staffRole: string;
}

export function DashboardClient({ staffName, staffRole }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [zone, setZone] = useState<Zone>("");
  const [seatTarget, setSeatTarget] = useState<WaitlistEntry | null>(null);
  const [preOrderTarget, setPreOrderTarget] = useState<WaitlistEntry | null>(null);
  const [walkInTable, setWalkInTable] = useState<Table | null>(null);
  const [floorMapOpen, setFloorMapOpen] = useState(true);

  // Waitlist entries — 5s polling
  const { data: entries = [] } = useQuery<WaitlistEntry[]>({
    queryKey: ["waitlist-entries", tab, zone],
    queryFn: async () => {
      const params = new URLSearchParams({ status: TAB_STATUS[tab] });
      if (zone) params.set("zone", zone);
      const res = await fetch(`/api/waitlist?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5_000,
  });

  // Tables — 15s polling
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: async () => {
      const res = await fetch("/api/tables");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  // Metrics
  const activeEntries = entries.filter(
    (e) => e.status === "WAITING" || e.status === "NOTIFIED",
  );
  const totalOnList = tab === "active" ? entries.length : activeEntries.length;
  const avgWait =
    activeEntries.length > 0
      ? Math.round(
          activeEntries.reduce(
            (sum, e) => sum + (e.estimated_wait_minutes ?? 0),
            0,
          ) / activeEntries.length,
        )
      : 0;
  const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;

  // Mutations
  const notifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/waitlist/${id}/notify`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] }),
  });

  const tableStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/tables/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const handleNotify = useCallback(
    (entry: WaitlistEntry) => {
      if (entry.status !== "WAITING") return;
      notifyMutation.mutate(entry.id);
    },
    [notifyMutation],
  );

  const handleRemove = useCallback(
    (entry: WaitlistEntry) => {
      removeMutation.mutate(entry.id);
    },
    [removeMutation],
  );

  return (
    <>
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Header + Metrics */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-4xl font-headline font-bold text-on-surface mb-2">
                Concierge Overview
              </h1>
              <div className="flex items-center gap-4">
                <p className="text-on-surface-variant font-body tracking-wider uppercase text-sm">
                  Real-time floor management
                </p>
                <span className="h-4 w-px bg-outline-variant/30" />
                <p className="text-on-surface-variant font-body text-xs flex items-center gap-1.5">
                  Signed in:{" "}
                  <span className="text-on-surface font-semibold">
                    {staffName}
                  </span>
                  <Badge tone="success">{staffRole}</Badge>
                </p>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-auto">
              <div className="bg-surface-container-low p-6 rounded-xl ghost-border">
                <p className="text-xs font-label uppercase text-on-surface-variant tracking-widest mb-1">
                  Total on List
                </p>
                <p className="text-3xl font-headline text-primary">
                  {totalOnList}
                </p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl ghost-border">
                <p className="text-xs font-label uppercase text-on-surface-variant tracking-widest mb-1">
                  Average Wait
                </p>
                <p className="text-3xl font-headline text-on-surface">
                  {avgWait}
                  <span className="text-lg">m</span>
                </p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl ghost-border">
                <p className="text-xs font-label uppercase text-on-surface-variant tracking-widest mb-1">
                  Available Tables
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-headline text-tertiary">
                    {availableTables}
                  </p>
                  <span className="flex h-2 w-2 rounded-full bg-tertiary animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Tab + Zone filter */}
          <div className="flex justify-between items-center border-b border-outline-variant/15 pb-4">
            <div className="flex gap-8">
              {(["active", "seated", "cancelled"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`font-label text-sm uppercase tracking-widest relative ${
                    tab === t
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-on-surface transition-colors"
                  }`}
                >
                  {t === "active"
                    ? "Active Queue"
                    : t.charAt(0).toUpperCase() + t.slice(1)}
                  {tab === t && (
                    <span className="absolute -bottom-4 left-0 w-full h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex p-1 bg-surface-container rounded-lg ghost-border">
              {(["", "Main Dining", "Patio", "Bar"] as Zone[]).map((z) => (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md ${
                    zone === z
                      ? "bg-surface-container-highest text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {z || "All Zones"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Floor map — collapsible panel on narrow screens */}
        <div className="xl:hidden mb-6">
          <button
            onClick={() => setFloorMapOpen(!floorMapOpen)}
            className="w-full flex items-center justify-between bg-surface-container-low rounded-xl px-6 py-4 ghost-border"
          >
            <div className="flex items-center gap-4">
              <h2 className="font-headline text-lg text-on-surface">Floor Map</h2>
              <div className="flex gap-3 text-xs font-label">
                <span className="text-tertiary">
                  {tables.filter((t) => t.status === "AVAILABLE").length} open
                </span>
                <span className="text-error">
                  {tables.filter((t) => t.status === "OCCUPIED").length} occupied
                </span>
                <span className="text-secondary">
                  {tables.filter((t) => t.status === "CLEANING").length} cleaning
                </span>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-on-surface-variant transition-transform ${floorMapOpen ? "rotate-180" : ""}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
          {floorMapOpen && (
            <div className="bg-surface-container-low rounded-b-xl px-6 pb-6 -mt-2 pt-4 ghost-border border-t-0">
              <p className="font-label text-[10px] text-on-surface-variant mb-4">
                Tap available → seat walk-in · occupied → cleaning → available
              </p>
              <TableFloorMap
                mode="manage"
                tables={tables}
                onStatusChange={(id, status) =>
                  tableStatusMutation.mutate({ id, status })
                }
                onSeatWalkIn={(table) => setWalkInTable(table)}
              />
            </div>
          )}
        </div>

        {/* Waitlist table + Floor map side-by-side */}
        <div className="flex gap-8 items-start">

        {/* Table */}
        <div className="flex-1 min-w-0 bg-surface-container-low rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant uppercase text-[10px] tracking-[0.2em] font-label">
                  <th className="px-8 py-5 font-semibold">Pos</th>
                  <th className="px-8 py-5 font-semibold">Guest Details</th>
                  <th className="px-8 py-5 font-semibold">Party</th>
                  <th className="px-8 py-5 font-semibold">Wait Time</th>
                  <th className="px-8 py-5 font-semibold">Preferred Zone</th>
                  <th className="px-8 py-5 font-semibold text-center">
                    Pre-Order
                  </th>
                  {tab === "active" && (
                    <th className="px-8 py-5 font-semibold text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-8 py-16 text-center text-on-surface-variant italic font-body"
                    >
                      No entries
                    </td>
                  </tr>
                )}
                {entries.map((entry, idx) => {
                  const chip = waitChip(entry);
                  const matched = matchingTables(tables, entry);
                  return (
                    <tr
                      key={entry.id}
                      className="group hover:bg-surface-container-high transition-colors"
                    >
                      <td className="px-8 py-6">
                        <span className="text-xl font-headline text-on-surface-variant/50">
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-lg font-headline font-bold text-on-surface">
                            {entry.guest_name}
                          </span>
                          <span className="text-xs font-label text-on-surface-variant">
                            {entry.phone_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 font-body text-on-surface">
                        {entry.party_size} Guests
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-on-surface font-semibold">
                            {entry.estimated_wait_minutes ?? "—"}m
                          </span>
                          {chip && (
                            <span
                              className={`text-[10px] uppercase tracking-tighter ${chip.color} flex items-center gap-1`}
                            >
                              {chip.ping && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-tertiary animate-ping" />
                              )}
                              {chip.text}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          {entry.preferred_zone ? (
                            <span className="bg-primary-container/20 text-primary px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest w-fit">
                              {entry.preferred_zone}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40 italic text-xs">
                              Any
                            </span>
                          )}
                          {matched.length > 0 && (
                            <span className="text-[10px] text-on-surface-variant">
                              {matched.join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        {entry.pre_order ? (
                          <button
                            onClick={() => setPreOrderTarget(entry)}
                            className="inline-flex items-center gap-2 text-primary hover:text-primary-fixed transition-colors font-label text-xs uppercase tracking-widest border border-primary/20 px-4 py-2 rounded-lg"
                          >
                            View Order
                          </button>
                        ) : (
                          <span className="text-on-surface-variant/40 italic font-label text-xs">
                            No Pre-Order
                          </span>
                        )}
                      </td>
                      {tab === "active" && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-3">
                            {/* Seat */}
                            <button
                              onClick={() => setSeatTarget(entry)}
                              className="p-2 hover:bg-tertiary/10 text-tertiary rounded-lg transition-colors"
                              title="Seat Guest"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M4 18v3h3v-3h10v3h3v-6H4v3zm15-8h3v3h-3v-3zM2 10h3v3H2v-3zm15.5-2c0-2.76-2.24-5-5-5s-5 2.24-5 5v3h10V8z" />
                              </svg>
                            </button>
                            {/* Notify */}
                            <button
                              onClick={() => handleNotify(entry)}
                              disabled={
                                entry.status !== "WAITING" ||
                                notifyMutation.isPending
                              }
                              className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors disabled:opacity-30"
                              title="Notify Guest"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                              </svg>
                            </button>
                            {/* Remove */}
                            <button
                              onClick={() => handleRemove(entry)}
                              disabled={removeMutation.isPending}
                              className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors disabled:opacity-30"
                              title="Remove"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floor map — sticky sidebar */}
        <div className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-8 bg-surface-container-low rounded-xl p-6 shadow-2xl ghost-border">
            <h2 className="font-headline text-lg text-on-surface mb-1">Floor Map</h2>
            <p className="font-label text-[10px] text-on-surface-variant mb-4">
              Tap occupied → cleaning → available
            </p>
            <div className="flex flex-wrap gap-3 mb-4 text-xs font-label">
              <span className="text-tertiary">
                {tables.filter((t) => t.status === "AVAILABLE").length} open
              </span>
              <span className="text-error">
                {tables.filter((t) => t.status === "OCCUPIED").length} occupied
              </span>
              <span className="text-secondary">
                {tables.filter((t) => t.status === "CLEANING").length} cleaning
              </span>
            </div>
            <TableFloorMap
              mode="manage"
              tables={tables}
              onStatusChange={(id, status) =>
                tableStatusMutation.mutate({ id, status })
              }
              onSeatWalkIn={(table) => setWalkInTable(table)}
            />
          </div>
        </div>

        </div>{/* end flex row */}

        {/* Footer actions */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-on-surface-variant font-label text-xs uppercase tracking-[0.2em]">
            Showing {entries.length} entries
            {zone ? ` in ${zone}` : " across all zones"}
          </p>
          <a
            href="/waitlist"
            className="px-6 py-3 bg-gold-gradient text-on-primary rounded-lg font-bold font-label text-xs uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95"
          >
            + Add Guest
          </a>
        </div>
      </main>

      {/* Seat modal */}
      {seatTarget && (
        <SeatGuestModal
          entry={seatTarget}
          tables={tables}
          onClose={() => setSeatTarget(null)}
          onSeated={() => {
            setSeatTarget(null);
            queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] });
            queryClient.invalidateQueries({ queryKey: ["tables"] });
          }}
        />
      )}

      {/* Pre-order modal */}
      {preOrderTarget && (
        <PreOrderModal
          entryId={preOrderTarget.id}
          guestName={preOrderTarget.guest_name}
          onClose={() => setPreOrderTarget(null)}
        />
      )}

      {/* Walk-in dialog */}
      {walkInTable && (
        <WalkInDialog
          table={walkInTable}
          onClose={() => setWalkInTable(null)}
          onSeated={() => {
            setWalkInTable(null);
            queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] });
            queryClient.invalidateQueries({ queryKey: ["tables"] });
          }}
        />
      )}
    </>
  );
}
