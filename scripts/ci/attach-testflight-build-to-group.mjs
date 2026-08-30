#!/usr/bin/env node
// Waits for an App Store Connect build to become TestFlight-ready and attaches
// it to the requested internal tester group.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const required = ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_APP_ID", "ASC_VERSION_STRING"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
}

if (!process.env.ASC_PRIVATE_KEY && !process.env.ASC_PRIVATE_KEY_FILE) {
  console.error("Missing required env: ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_FILE");
  process.exit(1);
}

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const PRIVATE_KEY = loadPrivateKey();
const APP_ID = process.env.ASC_APP_ID;
const VERSION = process.env.ASC_VERSION_STRING;
const BUILD_NUMBER = process.env.ASC_BUILD_NUMBER || null;
const GROUP_NAME = process.env.ASC_BETA_GROUP_NAME || "Internal Testers";
const REQUIRED_TESTER_EMAIL = process.env.ASC_REQUIRED_TESTER_EMAIL?.trim().toLowerCase() || null;
const WAIT_ATTEMPTS = parsePositiveInt(process.env.ASC_WAIT_ATTEMPTS, 30);
const WAIT_SECONDS = parsePositiveInt(process.env.ASC_WAIT_SECONDS, 60);
const API = "https://api.appstoreconnect.apple.com/v1";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadPrivateKey() {
  if (process.env.ASC_PRIVATE_KEY_FILE) {
    return readFileSync(process.env.ASC_PRIVATE_KEY_FILE, "utf8");
  }

  const trimmed = process.env.ASC_PRIVATE_KEY.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return trimmed.replaceAll("\\n", "\n");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
    if (decoded.includes("BEGIN PRIVATE KEY")) {
      return decoded.replaceAll("\\n", "\n");
    }
  } catch {
    // Fall through to raw value.
  }

  return trimmed.replaceAll("\\n", "\n");
}

function buildJwt() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat, exp: iat + 20 * 60, aud: "appstoreconnect-v1" };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer
    .sign({ key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

async function asc(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${buildJwt()}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`ASC ${method} ${path} -> ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findGroup() {
  const params = new URLSearchParams({
    "filter[app]": APP_ID,
    limit: "50",
  });
  const body = await asc("GET", `/betaGroups?${params}`);
  const group = body.data?.find((candidate) => candidate.attributes?.name === GROUP_NAME);
  if (!group) {
    throw new Error(`TestFlight beta group "${GROUP_NAME}" was not found for app ${APP_ID}.`);
  }
  return group;
}

async function findBuild() {
  const params = new URLSearchParams({
    "filter[app]": APP_ID,
    "filter[preReleaseVersion.version]": VERSION,
    sort: "-uploadedDate",
    limit: "10",
  });

  if (BUILD_NUMBER) {
    params.set("filter[version]", BUILD_NUMBER);
    params.set("limit", "1");
  }

  const body = await asc("GET", `/builds?${params}`);
  return body.data?.find((build) => build.attributes?.processingState === "VALID") || body.data?.[0] || null;
}

async function findValidBuild() {
  for (let attempt = 1; attempt <= WAIT_ATTEMPTS; attempt += 1) {
    const build = await findBuild();
    if (build?.attributes?.processingState === "VALID") {
      console.log(`Using TestFlight build ${VERSION} (${build.attributes.version}) ${build.id}.`);
      return build;
    }

    const state = build?.attributes?.processingState || "not visible";
    console.log(`Waiting for TestFlight build ${VERSION}${BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""}: ${state}.`);
    if (attempt < WAIT_ATTEMPTS) {
      await sleep(WAIT_SECONDS * 1000);
    }
  }

  throw new Error(`No VALID App Store Connect build found for ${VERSION}${BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""}.`);
}

async function listGroupsForBuild(buildId) {
  const params = new URLSearchParams({
    "filter[builds]": buildId,
    limit: "50",
  });
  const body = await asc("GET", `/betaGroups?${params}`);
  return body.data || [];
}

async function listTestersForGroup(groupId) {
  const params = new URLSearchParams({
    "fields[betaTesters]": "email",
    limit: "200",
  });
  const body = await asc("GET", `/betaGroups/${groupId}/betaTesters?${params}`);
  return body.data || [];
}

async function attachGroup(buildId, groupId) {
  await asc("POST", `/builds/${buildId}/relationships/betaGroups`, {
    data: [{ type: "betaGroups", id: groupId }],
  });
}

const group = await findGroup();
const build = await findValidBuild();
const existingGroups = await listGroupsForBuild(build.id);
if (existingGroups.some((candidate) => candidate.id === group.id)) {
  console.log(`Build is already attached to "${GROUP_NAME}".`);
} else {
  await attachGroup(build.id, group.id);
  console.log(`Attached build to "${GROUP_NAME}".`);
}

const finalGroups = await listGroupsForBuild(build.id);
const finalNames = finalGroups.map((candidate) => candidate.attributes.name);
if (!finalNames.includes(GROUP_NAME)) {
  throw new Error(`Build was not attached to "${GROUP_NAME}". Current groups: ${finalNames.join(", ") || "none"}.`);
}

console.log(`Verified TestFlight group: ${GROUP_NAME}.`);

if (REQUIRED_TESTER_EMAIL) {
  const testers = await listTestersForGroup(group.id);
  const hasRequiredTester = testers.some(
    (tester) => tester.attributes?.email?.trim().toLowerCase() === REQUIRED_TESTER_EMAIL,
  );
  if (!hasRequiredTester) {
    throw new Error(`Required tester ${REQUIRED_TESTER_EMAIL} is not in "${GROUP_NAME}".`);
  }
  console.log(`Verified required tester: ${REQUIRED_TESTER_EMAIL}.`);
}
