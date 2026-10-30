// Builds docs/ux-audit/site from measured runs and the authored content files.
// Run: node docs/ux-audit/build-site.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = import.meta.dirname;
const runs = path.join(root, "runs");
const site = path.join(root, "site");
const content = (name) => JSON.parse(fs.readFileSync(path.join(root, "content", name), "utf8"));

const PROJECTS = ["desktop-festive", "desktop-apple", "mobile-festive", "mobile-apple"];
const JOURNEYS = [
  ["j1-gift-lists", "Manage your gift lists"],
  ["j2-exchange", "Create an exchange and get everyone assigned"],
  ["j3-log-in-out", "Log in and out"],
  ["j4-navigation", "Navigate the site"],
  ["j5-wishlist", "Add things to a wishlist"],
];
const EXTRAS = [
  ["u1-unhappy-paths", "Unhappy paths"],
  ["k1-keyboard", "Keyboard only"],
  ["r1-regressions", "Late fixes in a browser"],
];

const esc = (value) =>
  String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function metrics(run, project, journey) {
  const file = path.join(runs, run, project, journey, "metrics.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

const EXPECTED_ERRORS = /broken link|made-up invite|Impossible rules/;
const realErrors = (m) => m.events.filter((event) => !EXPECTED_ERRORS.test(event.step)).length;

function allRuns(run, journey) {
  return PROJECTS.map((project) => metrics(run, project, journey)).filter(Boolean);
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const serious = (m) => m.axe.filter((a) => ["serious", "critical"].includes(a.impact)).length;
const stepsPassed = (m) => m.steps.filter((s) => s.status === "pass").length;

function chips(run, journey) {
  return PROJECTS.map((project) => {
    const m = metrics(run, project, journey);
    const state = !m ? "none" : m.pass ? "pass" : "fail";
    const label = `${project.replace("-", " ")}: ${!m ? "not run" : m.pass ? "pass" : "fail"}`;
    return `<span class="chip ${state}" title="${esc(label)}" aria-label="${esc(label)}">${m ? (m.pass ? "✓" : "✕") : "–"}</span>`;
  }).join("");
}

function stat(before, after, format = (v) => v) {
  return `<td class="num">${before.length ? format(mean(before)) : "–"}</td><td class="num">${after.length ? format(mean(after)) : "–"}</td>`;
}

function scoreRow([id, name]) {
  const b = allRuns("before", id);
  const a = allRuns("after", id);
  const round = (v) => Math.round(v);
  const steps = (list) =>
    list.length ? `${list.reduce((n, m) => n + stepsPassed(m), 0)}/${list.reduce((n, m) => n + m.steps.length, 0)}` : "–";
  return `<tr>
    <th scope="row">${esc(name)}</th>
    <td class="chips">${chips("before", id)}</td>
    <td class="chips">${chips("after", id)}</td>
    <td class="num">${steps(b)}</td><td class="num">${steps(a)}</td>
    ${stat(b.map((m) => m.clicks), a.map((m) => m.clicks), round)}
    ${stat(b.map((m) => m.activeMs / 1000), a.map((m) => m.activeMs / 1000), (v) => `${round(v)}s`)}
    ${stat(b.map(realErrors), a.map(realErrors), round)}
    ${stat(b.map(serious), a.map(serious), round)}
  </tr>`;
}

function frameImage(run, project, journey, file) {
  const source = path.join(runs, run, project, journey, file);
  if (!fs.existsSync(source)) throw new Error(`Missing frame ${source}`);
  const name = `${run}-${project}-${journey}-${file.replace(/\.png$/, "")}.jpg`;
  const target = path.join(site, "img", name);
  if (!fs.existsSync(target)) {
    execFileSync("magick", [source, "-resize", "1000x>", "-strip", "-quality", "76", target]);
  }
  return `img/${name}`;
}

function shot(src, label, alt) {
  return `<figure class="shot"><button type="button" class="zoom" data-full="${src}" aria-label="Enlarge: ${esc(alt)}"><img src="${src}" alt="${esc(alt)}" loading="lazy"></button><figcaption>${esc(label)}</figcaption></figure>`;
}

function pairs(item) {
  return (item.frames ?? [])
    .map((frame) => {
      const before = frame.before
        ? shot(frameImage("before", frame.project, frame.journey, frame.before), `Before · ${frame.project}`, `Before: ${item.title}`)
        : "";
      const after = frame.after
        ? shot(frameImage("after", frame.project, frame.journey, frame.after), `After · ${frame.project}`, `After: ${item.title}`)
        : "";
      return `<div class="pair">${before}${after}</div>`;
    })
    .join("");
}

function commits(list, repo) {
  return (list ?? [])
    .map((hash) => `<a class="hash" href="${repo}/commit/${hash}">${esc(hash.slice(0, 7))}</a>`)
    .join(" ");
}

function decisionCard(item, repo) {
  return `<article class="decision" data-journey="${esc(item.journey)}" data-severity="${item.severity}" id="${esc(item.id)}">
    <header><span class="sev s${item.severity}">Severity ${item.severity}</span><h3>${esc(item.title)}</h3></header>
    <dl>
      <div><dt>Problem</dt><dd>${esc(item.problem)}</dd></div>
      <div><dt>Repro</dt><dd>${esc(item.repro)}</dd></div>
      <div><dt>Evidence</dt><dd>${esc(item.evidence)}</dd></div>
      <div><dt>Change and why</dt><dd>${esc(item.change)}</dd></div>
      <div><dt>Heuristic</dt><dd>${esc(item.heuristic)}</dd></div>
      <div><dt>Commit</dt><dd>${commits(item.commits, repo) || "None"}</dd></div>
    </dl>
    ${pairs(item)}
  </article>`;
}

function openCard(item) {
  const concept = item.concept
    ? `<figure class="shot concept"><button type="button" class="zoom" data-full="${esc(item.concept)}" aria-label="Enlarge concept for ${esc(item.title)}"><img src="${esc(item.concept)}" alt="Concept mockup: ${esc(item.title)}" loading="lazy"></button><figcaption><strong>Concept, not built</strong></figcaption></figure>`
    : "";
  return `<article class="open" id="${esc(item.id)}">
    <header><span class="sev s${item.severity}">Severity ${item.severity} · Product decision</span><h3>${esc(item.title)}</h3></header>
    <p>${esc(item.question)}</p>
    <p class="rec"><strong>Recommendation.</strong> ${esc(item.recommendation)}</p>
    ${concept}
  </article>`;
}

function featureRow(item, index) {
  const evidence = (item.evidence ?? [])
    .map((e) => (e.url ? `<li>“${esc(e.quote)}” <a href="${esc(e.url)}">${esc(e.source)}</a></li>` : `<li>${esc(e.quote)} <span class="muted">${esc(e.source)}</span></li>`))
    .join("");
  return `<article class="feature">
    <span class="rank">${index + 1}</span>
    <div><h3>${esc(item.title)}</h3>
    <p>${esc(item.problem)}</p>
    <p class="meta"><span>For ${esc(item.who)}</span><span>Effort ${esc(item.effort)}</span></p>
    <p class="why"><strong>Why it ranks here.</strong> ${esc(item.why)}</p>
    <ul class="evidence">${evidence}</ul></div>
  </article>`;
}

function hallway(script) {
  const tasks = script.tasks
    .map((task) => `<li><strong>${esc(task.title)}.</strong> “${esc(task.say)}” <span class="muted">Passes if ${esc(task.pass)}</span></li>`)
    .join("");
  return `<p>${esc(script.intro)}</p><ol class="tasks">${tasks}</ol>
    <h3>While you watch</h3><ul>${script.rules.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>
    <h3>Afterwards</h3><ul>${script.after.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>`;
}

function fresh(report) {
  if (!report) return "<p>Pending.</p>";
  const rows = report.tasks
    .map((task) => `<tr><th scope="row">${esc(task.name)}</th><td><span class="${task.pass ? "pass-word" : "fail-word"}">${task.pass ? "Pass" : "Fail"}</span></td><td>${esc(task.note)}</td></tr>`)
    .join("");
  return `<p>${esc(report.intro)}</p>
    <div class="tablewrap"><table class="plain"><thead><tr><th scope="col">Task</th><th scope="col">Result</th><th scope="col">Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>Stumbles</h3><ul>${report.stumbles.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`;
}

const meta = content("meta.json");
const decisions = content("decisions.json").sort((a, b) => b.severity - a.severity);
const open = content("open-decisions.json");
const features = content("features.json");
const script = content("hallway.json");

const journeyFilters = [...new Set(decisions.map((d) => d.journey))]
  .map((j) => `<button type="button" class="filter" data-filter="${esc(j)}" aria-pressed="false">${esc(j)}</button>`)
  .join("");

const template = fs.readFileSync(path.join(root, "site-template.html"), "utf8");
const page = template
  .replaceAll("{{found}}", String(meta.found))
  .replaceAll("{{fixed}}", String(meta.fixed))
  .replaceAll("{{openCount}}", String(meta.open))
  .replaceAll("{{summary}}", esc(meta.summary))
  .replace("{{scoreRows}}", JOURNEYS.map(scoreRow).join(""))
  .replace("{{extraRows}}", EXTRAS.map(scoreRow).join(""))
  .replace("{{filters}}", journeyFilters)
  .replace("{{decisions}}", decisions.map((d) => decisionCard(d, meta.repo)).join(""))
  .replace("{{open}}", open.map(openCard).join(""))
  .replace("{{hallway}}", hallway(script))
  .replace("{{features}}", features.map(featureRow).join(""))
  .replace("{{fresh}}", fresh(meta.fresh))
  .replace("{{limits}}", meta.limits.map((line) => `<li>${esc(line)}</li>`).join(""))
  .replace("{{verified}}", meta.verified.map((line) => `<li>${esc(line)}</li>`).join(""));

fs.writeFileSync(path.join(site, "index.html"), page);
console.log(`Wrote site/index.html with ${decisions.length} decisions, ${open.length} open, ${features.length} features.`);
