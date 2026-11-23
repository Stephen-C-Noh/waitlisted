import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const POS_TABLES =
  "tables|orders|order_items|order_item_modifiers|users|menu_items|menu_categories|modifiers|menu_item_modifiers|payments|outbox_events|idempotency_records";
// Any client (prisma, tx, ...), chains split across lines, every write variant
// (createManyAndReturn, ...), and raw SQL: every $executeRaw, and $queryRaw
// whose statement (up to the next `;`) contains INSERT/UPDATE/DELETE.
const POS_WRITE = new RegExp(
  `\\b\\w+\\s*\\.\\s*(${POS_TABLES})\\s*\\.\\s*(create|update|upsert|delete)\\w*\\b` +
    `|\\$executeRaw\\w*|\\$queryRaw\\w*[^;]*?\\b(INSERT|UPDATE|DELETE)\\b`,
  "gi",
);

/** Line numbers (1-based) of Prisma writes to POS-owned tables in `text`. */
function posWrites(text: string): number[] {
  return [...text.matchAll(POS_WRITE)].map((m) => text.slice(0, m.index).split("\n").length);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("posWrites", () => {
  it.each([
    ["direct call", "await prisma.tables.update({ where });"],
    ["transaction client", "await tx.tables.update({ where });"],
    ["chain split across lines", "await prisma.tables\n  .update({ where });"],
    ["AndReturn variant", "await prisma.orders.createManyAndReturn({ data });"],
    ["raw execute", "await prisma.$executeRaw`UPDATE tables SET status = 'X'`;"],
    ["raw query", "await prisma.$queryRaw`UPDATE tables SET status = 'X'`;"],
  ])("flags a %s", (_name, code) => {
    expect(posWrites(code)).toEqual([1]);
  });

  it.each([
    ["a read", "await prisma.tables.findUnique({ where });"],
    ["a waitlist write", "await prisma.waitlist_entries.update({ where });"],
    ["a raw read", "await prisma.$queryRaw`SELECT 1`;"],
  ])("ignores %s", (_name, code) => {
    expect(posWrites(code)).toEqual([]);
  });
});

describe("POS-owned tables", () => {
  it("are never written through Prisma (only the POS changes them)", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      posWrites(readFileSync(file, "utf8")).map((line) => `${file}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});
