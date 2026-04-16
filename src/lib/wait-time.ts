import { prisma } from "./prisma";

/* ---------- constants ---------- */

/** Average time a party occupies a table (high-end dining: courses + drinks + dessert) */
const AVG_DINING_DURATION = 90;

/** Buffer for clearing, cleaning, and resetting a table */
const TABLE_TURNOVER_BUFFER = 10;

/** Full table cycle: dining + turnover */
const TOTAL_CYCLE_TIME = AVG_DINING_DURATION + TABLE_TURNOVER_BUFFER;

/** Occupied tables are on average halfway through their cycle */
const AVG_REMAINING_TIME = TOTAL_CYCLE_TIME / 2; // 50

const MIN_WAIT = 5;
const MAX_WAIT = 150;
const ROUND_TO = 5;

/* ---------- helpers ---------- */

function clampAndRound(minutes: number): number {
  const clamped = Math.max(MIN_WAIT, Math.min(MAX_WAIT, minutes));
  return Math.round(clamped / ROUND_TO) * ROUND_TO;
}

/* ---------- main ---------- */

export interface WaitEstimate {
  /** Point estimate in minutes, clamped [5,150] and rounded to nearest 5 */
  minutes: number;
  /** Display range: minutes ± 5, minimum 5 */
  low: number;
  high: number;
}

/**
 * Estimates the wait time for a party of the given size.
 *
 * Algorithm (from plan §8):
 *  1. Find compatible tables (capacity >= partySize)
 *  2. Count AVAILABLE compatible tables
 *  3. Count WAITING parties ahead competing for same-capacity tables
 *  4. If available > partiesAhead → immediate seating (5 min)
 *  5. effectiveWait = partiesAhead - available
 *  6. occupiedCompatible = compatible tables with OCCUPIED status
 *  7. cyclesNeeded = ceil((effectiveWait + 1) / max(occupiedCompatible, 1))
 *  8. estimate = cyclesNeeded * avgRemainingTime
 *  9. Clamp to [5, 150], round to nearest 5
 * 10. Display as estimate ± 5
 */
export async function estimateWaitMinutes(
  partySize: number,
): Promise<WaitEstimate> {
  // 1. Compatible tables: capacity >= partySize
  const compatibleTables = await prisma.tables.findMany({
    where: { capacity: { gte: partySize } },
    select: { id: true, status: true },
  });

  // 2. Available compatible tables
  const available = compatibleTables.filter(
    (t) => t.status === "AVAILABLE",
  ).length;

  // 3. Parties waiting ahead competing for same-capacity tables
  const partiesAhead = await prisma.waitlist_entries.count({
    where: {
      status: { in: ["WAITING", "NOTIFIED"] },
      party_size: { lte: partySize },
    },
  });

  // 4. Immediate seating
  if (available > partiesAhead) {
    return { minutes: MIN_WAIT, low: MIN_WAIT, high: MIN_WAIT + 5 };
  }

  // 5–6
  const effectiveWait = partiesAhead - available;
  const occupiedCompatible = compatibleTables.filter(
    (t) => t.status === "OCCUPIED",
  ).length;

  // 7–8
  const cyclesNeeded = Math.ceil(
    (effectiveWait + 1) / Math.max(occupiedCompatible, 1),
  );
  const rawEstimate = cyclesNeeded * AVG_REMAINING_TIME;

  // 9
  const minutes = clampAndRound(rawEstimate);

  // 10
  const low = Math.max(MIN_WAIT, minutes - 5);
  const high = Math.min(MAX_WAIT + 5, minutes + 5);

  return { minutes, low, high };
}
