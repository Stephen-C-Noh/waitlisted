import { spawnSync } from "node:child_process";

// advisory ID -> reason. All come from the prisma CLI chain, not shipped in the runtime image.
const ALLOW = new Map([
  [1145093, "deepmerge-ts: prisma CLI only"],
  [1153173, "mysql2: prisma CLI only"]
]);

const r = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });

// 1. fail closed
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error("npm audit produced no parseable JSON.");
  process.exit(1);
}
if (!report.vulnerabilities) {
  console.error("npm audit output has no vulnerabilities field.");
  process.exit(1);
}
// 2. collect real advisories (objects only), dedupe by source
const found = new Map();
for (const pkg of Object.values(report.vulnerabilities)) {
  for (const v of pkg.via) {
    if (typeof v === "string") continue;
    found.set(v.source, v);
  }
}


// 3. split into allowed / violations
const violations = [];
for (const [id, v] of found) {
  if (v.severity !== "high" && v.severity !== "critical") continue;
  if (ALLOW.has(id)) {
    console.log(`allowed: ${id} ${ALLOW.get(id)}`);
  } else {
    violations.push(v);
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`violation: ${v.source} [${v.severity}] ${v.title}`);
  }
  process.exit(1);
}
console.log("audit gate passed");