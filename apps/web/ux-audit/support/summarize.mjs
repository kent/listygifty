// Prints each journey's steps for one run: node summarize.mjs <run> [project] [--brief]
import fs from "node:fs";
import path from "node:path";

const [run = "scratch", project] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const brief = process.argv.includes("--brief");
const root = path.resolve(import.meta.dirname, "../../../../docs/ux-audit/runs", run);

for (const proj of fs.readdirSync(root).sort()) {
  if (project && proj !== project) continue;
  for (const journey of fs.readdirSync(path.join(root, proj)).sort()) {
    const file = path.join(root, proj, journey, "metrics.json");
    if (!fs.existsSync(file)) continue;
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    const passed = m.steps.filter((s) => s.status === "pass").length;
    const serious = m.axe.filter((a) => ["serious", "critical"].includes(a.impact)).length;
    console.log(`${m.pass ? "PASS" : "FAIL"} ${proj}/${journey} steps=${passed}/${m.steps.length} clicks=${m.clicks} active=${Math.round(m.activeMs / 1000)}s errors=${m.errors} axe=${m.axe.length} (serious+=${serious})`);
    if (brief) continue;
    for (const s of m.steps) {
      if (s.status !== "pass") console.log(`   ${s.status.toUpperCase()} ${s.name}\n        ${(s.note ?? "").slice(0, 240)}`);
    }
    const seen = new Set();
    for (const e of m.events) {
      const key = `${e.kind}:${e.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`   ${e.kind} @${e.step}: ${e.text.slice(0, 160)}`);
    }
  }
}
