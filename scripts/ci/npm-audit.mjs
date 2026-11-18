#!/usr/bin/env node
// `npm audit --audit-level=high` with a reviewed allowlist.
//
// npm audit has no way to ignore a single advisory, and its database can lag
// GitHub's by hours (a withdrawn advisory kept failing CI after GitHub pulled
// it). This fails on every high/critical advisory except the ones listed in
// scripts/ci/npm-audit-allowlist.json, and a package that is only vulnerable
// through allowlisted advisories is not counted either.
//
// Usage: node scripts/ci/npm-audit.mjs [--prefix <dir>]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FAILING = new Set(["high", "critical"]);
const allowlist = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "npm-audit-allowlist.json"), "utf8")
);
const allowed = new Map(allowlist.map((entry) => [entry.id, entry.reason]));

const args = ["audit", "--json", ...process.argv.slice(2)];
let raw;
try {
  raw = execFileSync("npm", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  raw = error.stdout;
  if (!raw) throw error;
}

const report = JSON.parse(raw);
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(2);
}

const vulnerabilities = report.vulnerabilities ?? {};
const advisoryId = (via) => via.url?.split("/").pop();

// The failing, non-allowlisted advisories that make a package vulnerable,
// following `via` chains through the packages it depends on.
const memo = new Map();
function blockingAdvisories(name, seen = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (seen.has(name)) return [];
  seen.add(name);

  const found = [];
  for (const via of vulnerabilities[name]?.via ?? []) {
    if (typeof via === "string") {
      found.push(...blockingAdvisories(via, seen));
    } else if (FAILING.has(via.severity) && !allowed.has(advisoryId(via))) {
      found.push(via);
    }
  }
  memo.set(name, found);
  return found;
}

const reported = new Set();
const blocking = new Map();
for (const [name, vuln] of Object.entries(vulnerabilities)) {
  for (const via of vuln.via) {
    if (typeof via !== "string") reported.add(advisoryId(via));
  }
  if (!FAILING.has(vuln.severity)) continue;
  for (const via of blockingAdvisories(name)) {
    blocking.set(advisoryId(via), via);
  }
}

for (const [id, reason] of allowed) {
  if (reported.has(id)) {
    console.log(`Allowlisted ${id}: ${reason}`);
  } else {
    console.log(`Allowlist entry ${id} no longer reported by npm audit; it can be removed.`);
  }
}

if (blocking.size === 0) {
  console.log("No unallowlisted high or critical vulnerabilities.");
  process.exit(0);
}

console.error(`\n${blocking.size} high/critical advisor${blocking.size === 1 ? "y" : "ies"} found:`);
for (const via of blocking.values()) {
  console.error(`  ${via.severity.padEnd(8)} ${via.name} ${via.range}  ${via.title}\n           ${via.url}`);
}
process.exit(1);
