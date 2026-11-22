"use client";

import { cn } from "@/lib/cn";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: string | null;
  status: string | null;
}

interface BaseProps {
  tables: Table[];
  preferredZone?: string | null;
}

interface SelectModeProps extends BaseProps {
  /** Select mode: pick a table to seat a guest. */
  mode: "select";
  partySize: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface ManageModeProps extends BaseProps {
  /** Manage mode: advance table lifecycle (OCCUPIED→CLEANING→AVAILABLE). */
  mode: "manage";
  /** False in cloud mode: status changes and walk-in seating need the POS. */
  disabled?: boolean;
  onStatusChange: (id: string, newStatus: string) => void;
  /** Tap an available table to seat a walk-in. */
  onSeatWalkIn?: (table: Table) => void;
}

type Props = SelectModeProps | ManageModeProps;

const ZONE_ORDER = ["Main Dining", "Patio", "Bar"];

function shapeClass(capacity: number) {
  if (capacity <= 2) return "w-14 h-14 rounded-full";
  if (capacity <= 4) return "w-14 h-14 rounded-lg";
  if (capacity <= 6) return "w-20 h-14 rounded-lg";
  return "w-24 h-14 rounded-lg";
}

/* ---------- select mode states ---------- */

type SelectState = "selectable" | "selected" | "too-small" | "occupied" | "cleaning";

function getSelectState(
  table: Table,
  partySize: number,
  selectedId: string | null,
): SelectState {
  if (table.id === selectedId) return "selected";
  if (table.status === "CLEANING") return "cleaning";
  if (table.status !== "AVAILABLE") return "occupied";
  if (table.capacity < partySize) return "too-small";
  return "selectable";
}

/* ---------- manage mode states ---------- */

type ManageState = "available" | "occupied" | "cleaning";

function getManageState(table: Table): ManageState {
  if (table.status === "CLEANING") return "cleaning";
  if (table.status === "AVAILABLE") return "available";
  return "occupied";
}

/* ---------- styles ---------- */

const selectStyles: Record<SelectState, string> = {
  selectable:
    "bg-tertiary/20 border-tertiary text-tertiary cursor-pointer hover:bg-tertiary/30 active:scale-95 transition-all",
  selected:
    "bg-primary/20 border-primary ring-2 ring-primary text-primary cursor-pointer transition-all",
  "too-small":
    "bg-surface-container border-outline-variant/20 text-on-surface-variant/30 cursor-not-allowed",
  occupied:
    "bg-error/10 border-error/20 text-error/40 cursor-not-allowed",
  cleaning:
    "bg-secondary-container/30 border-secondary/30 text-secondary/40 cursor-not-allowed",
};

const manageStyles: Record<ManageState, string> = {
  available:
    "bg-tertiary/20 border-tertiary text-tertiary cursor-pointer hover:bg-tertiary/30 active:scale-95 transition-all",
  occupied:
    "bg-error/10 border-error/30 text-error cursor-pointer hover:bg-error/20 active:scale-95 transition-all",
  cleaning:
    "bg-secondary-container/30 border-secondary/50 text-secondary cursor-pointer hover:bg-secondary-container/50 active:scale-95 transition-all",
};

/* ---------- component ---------- */

export function TableFloorMap(props: Props) {
  const { tables, preferredZone } = props;

  // Group by zone
  const byZone = new Map<string, Table[]>();
  for (const t of tables) {
    const zone = t.zone ?? "Other";
    if (!byZone.has(zone)) byZone.set(zone, []);
    byZone.get(zone)!.push(t);
  }

  const sortedZones = [...byZone.keys()].sort((a, b) => {
    if (preferredZone) {
      if (a === preferredZone) return -1;
      if (b === preferredZone) return 1;
    }
    return (ZONE_ORDER.indexOf(a) ?? 99) - (ZONE_ORDER.indexOf(b) ?? 99);
  });

  function handleClick(table: Table) {
    if (props.mode === "select") {
      const state = getSelectState(table, props.partySize, props.selectedId);
      if (state === "selectable" || state === "selected") {
        props.onSelect(table.id);
      }
    } else {
      // Manage mode: advance lifecycle or seat walk-in
      if (table.status === "AVAILABLE" && props.onSeatWalkIn) {
        props.onSeatWalkIn(table);
      } else if (table.status === "OCCUPIED") {
        props.onStatusChange(table.id, "CLEANING");
      } else if (table.status === "CLEANING") {
        props.onStatusChange(table.id, "AVAILABLE");
      }
    }
  }

  function isClickable(table: Table): boolean {
    if (props.mode === "select") {
      const state = getSelectState(table, props.partySize, props.selectedId);
      return state === "selectable" || state === "selected";
    }
    if (props.disabled) return false;
    return (
      table.status === "OCCUPIED" ||
      table.status === "CLEANING" ||
      (table.status === "AVAILABLE" && !!props.onSeatWalkIn)
    );
  }

  function getStyle(table: Table): string {
    if (props.mode === "select") {
      return selectStyles[getSelectState(table, props.partySize, props.selectedId)];
    }
    return manageStyles[getManageState(table)];
  }

  function getTooltip(table: Table): string {
    const base = `${table.table_number} — ${table.capacity} seats`;
    if (props.mode === "manage") {
      if (table.status === "OCCUPIED") return `${base} · Tap to mark needs cleaning`;
      if (table.status === "CLEANING") return `${base} · Tap to mark available`;
      return `${base} · Tap to seat walk-in`;
    }
    return `${base} (${table.status})`;
  }

  return (
    <div className="space-y-6">
      {sortedZones.map((zone) => {
        const zoneTables = byZone.get(zone) ?? [];
        const isPreferred = zone === preferredZone;

        return (
          <div key={zone}>
            <div className="flex items-center gap-3 mb-3">
              <span
                className={cn(
                  "font-label text-[10px] uppercase tracking-[0.2em]",
                  isPreferred ? "text-primary" : "text-on-surface-variant",
                )}
              >
                {zone}
              </span>
              {isPreferred && (
                <span className="font-label text-[9px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Preferred
                </span>
              )}
              <div className="h-px flex-grow bg-outline-variant/20" />
            </div>

            <div className="flex flex-wrap gap-3">
              {zoneTables.map((table) => {
                const clickable = isClickable(table);
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleClick(table)}
                    className={cn(
                      "border-2 flex flex-col items-center justify-center gap-0.5",
                      shapeClass(table.capacity),
                      getStyle(table),
                    )}
                    title={getTooltip(table)}
                  >
                    <span className="text-xs font-label font-bold leading-none">
                      {table.table_number}
                    </span>
                    <span className="text-[9px] font-label leading-none opacity-70">
                      {table.capacity}s
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/10">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-tertiary/20 border border-tertiary" />
          <span className="font-label text-[9px] uppercase tracking-wider text-on-surface-variant">
            Available
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-error/10 border border-error/30" />
          <span className="font-label text-[9px] uppercase tracking-wider text-on-surface-variant">
            Occupied
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-secondary-container/30 border border-secondary/50" />
          <span className="font-label text-[9px] uppercase tracking-wider text-on-surface-variant">
            Cleaning
          </span>
        </div>
        {props.mode === "select" && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-surface-container border border-outline-variant/20" />
            <span className="font-label text-[9px] uppercase tracking-wider text-on-surface-variant">
              Too Small
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
