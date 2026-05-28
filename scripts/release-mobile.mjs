#!/usr/bin/env node
// Listy Gifty mobile release helper.
//
// Usage:
//   npm run release                         # interactive patch/minor/major
//   npm run release -- patch                # bump 1.0.0 -> 1.0.1
//   npm run release -- minor                # bump 1.0.0 -> 1.1.0
//   npm run release -- major                # bump 1.0.0 -> 2.0.0
//   npm run release -- 1.2.3                # exact version
//   npm run release -- patch --dry-run      # show work without changing files
//
// What it does:
//   1. Verifies the working tree is clean
//   2. Bumps apps/mobile/app.json + apps/mobile/package.json + apps/mobile/package-lock.json
//   3. Commits the bump on the current branch
//   4. Creates and pushes the matching v<version> tag
//   5. Prints the TestFlight and App Store promotion links

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const APP_JSON = resolve(REPO_ROOT, "apps/mobile/app.json");
const MOBILE_PACKAGE_JSON = resolve(REPO_ROOT, "apps/mobile/package.json");
const MOBILE_PACKAGE_LOCK = resolve(REPO_ROOT, "apps/mobile/package-lock.json");
const ASC_APP_ID = "6759929474";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((arg) => !arg.startsWith("--"));

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", ...opts }).trim();
}

function shInherit(cmd) {
  execSync(cmd, { cwd: REPO_ROOT, stdio: "inherit" });
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function bump(version, kind) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    fail(`Cannot parse version "${version}". Expected semver like 1.2.3.`);
  }

  let [major, minor, patch] = parts;
  if (kind === "patch") {
    patch += 1;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else {
    fail(`Unknown bump "${kind}". Use patch, minor, major, or an exact x.y.z version.`);
  }

  return `${major}.${minor}.${patch}`;
}

async function prompt(question, defaultValue) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} `)).trim();
  rl.close();
  return answer || defaultValue;
}

const appJson = JSON.parse(readFileSync(APP_JSON, "utf8"));
const currentVersion = appJson.expo?.version;
if (!currentVersion) {
  fail(`${APP_JSON} is missing expo.version.`);
}

let targetVersion;
if (positional.length === 0) {
  console.log(`Current mobile version: ${currentVersion}\n`);
  const kind = (await prompt("Bump (patch / minor / major) [patch]:", "patch")).toLowerCase();
  targetVersion = bump(currentVersion, kind);
} else if (positional.length === 1) {
  const requested = positional[0];
  if (/^\d+\.\d+\.\d+$/.test(requested)) {
    targetVersion = requested;
  } else if (["patch", "minor", "major"].includes(requested)) {
    targetVersion = bump(currentVersion, requested);
  } else {
    fail(`Unknown arg "${requested}". Use patch, minor, major, or an exact x.y.z version.`);
  }
} else {
  fail("Too many arguments. Pass one of: patch, minor, major, or x.y.z.");
}

console.log(`Mobile release ${currentVersion} -> ${targetVersion}`);

if (!dryRun) {
  const dirty = sh("git status --porcelain");
  if (dirty) {
    fail(`Working tree is dirty. Commit or stash before releasing:\n${dirty}`);
  }

  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    const ok = await prompt(`You are on "${branch}", not "main". Tag from here anyway? [y/N]:`, "n");
    if (!/^y/i.test(ok)) {
      fail("Aborted.");
    }
  }

  sh("git fetch --tags --quiet");
  try {
    sh(`git rev-parse v${targetVersion}`);
    fail(`Tag v${targetVersion} already exists.`);
  } catch {
    // Missing tag is expected.
  }
}

console.log("");
console.log(`- Update apps/mobile/app.json version -> ${targetVersion}`);
console.log(`- Update apps/mobile/package.json version -> ${targetVersion}`);
console.log(`- Update apps/mobile/package-lock.json version -> ${targetVersion}`);
console.log(`- git commit -m "chore: release mobile v${targetVersion}"`);
console.log(`- git tag v${targetVersion}`);
console.log("- git push origin HEAD");
console.log(`- git push origin v${targetVersion}`);

if (dryRun) {
  console.log("\nDry run. No files changed.");
  process.exit(0);
}

const proceed = await prompt("\nProceed? [Y/n]:", "y");
if (!/^y/i.test(proceed)) {
  fail("Aborted.");
}

appJson.expo.version = targetVersion;
writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + "\n");

const mobilePackageJson = JSON.parse(readFileSync(MOBILE_PACKAGE_JSON, "utf8"));
mobilePackageJson.version = targetVersion;
writeFileSync(MOBILE_PACKAGE_JSON, JSON.stringify(mobilePackageJson, null, 2) + "\n");

const mobilePackageLock = JSON.parse(readFileSync(MOBILE_PACKAGE_LOCK, "utf8"));
mobilePackageLock.version = targetVersion;
if (mobilePackageLock.packages?.[""]) {
  mobilePackageLock.packages[""].version = targetVersion;
}
writeFileSync(MOBILE_PACKAGE_LOCK, JSON.stringify(mobilePackageLock, null, 2) + "\n");

shInherit(`git add ${APP_JSON} ${MOBILE_PACKAGE_JSON} ${MOBILE_PACKAGE_LOCK}`);
shInherit(`git commit -m "chore: release mobile v${targetVersion}"`);
shInherit(`git tag v${targetVersion}`);
shInherit("git push origin HEAD");
shInherit(`git push origin v${targetVersion}`);

const remote = sh("git config --get remote.origin.url");
const repoMatch = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
const repoPath = repoMatch ? repoMatch[1] : null;

console.log(`\nReleased mobile v${targetVersion}`);
if (repoPath) {
  console.log(`CI:         https://github.com/${repoPath}/actions/workflows/mobile-release.yml`);
  console.log(`Tag:        https://github.com/${repoPath}/releases/tag/v${targetVersion}`);
}
console.log(`TestFlight: https://appstoreconnect.apple.com/apps/${ASC_APP_ID}/testflight/ios`);
console.log(`App Store:  https://appstoreconnect.apple.com/apps/${ASC_APP_ID}/distribution`);
console.log("");
console.log("The tag queues a production-profile TestFlight build. Promote to App Store review later with the Mobile Release workflow's app_store_review action.");
