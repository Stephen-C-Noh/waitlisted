import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const POS_TABLES =
  "tables|orders|order_items|order_item_modifiers|users|menu_items|menu_categories|modifiers|menu_item_modifiers|payments|outbox_events|idempotency_records";
const POS_WRITE = new RegExp(
  `prisma\\.(${POS_TABLES})\\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\\b|\\$executeRaw`,
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("POS-owned tables", () => {
  it("are never written through Prisma (only the POS changes them)", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) => (POS_WRITE.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
