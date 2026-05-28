#!/usr/bin/env node
// Promotes the latest processed TestFlight build for a version to App Store review.
//
// Required env:
//   ASC_KEY_ID
//   ASC_ISSUER_ID
//   ASC_PRIVATE_KEY
//   ASC_APP_ID
//   ASC_VERSION_STRING
//   ASC_WHATS_NEW
//
// Optional env:
//   ASC_BUILD_NUMBER
//   ASC_RELEASE_TYPE      MANUAL (default), AFTER_APPROVAL, or SCHEDULED
//   ASC_LOCALE            default en-US

import { createSign } from "node:crypto";

const required = [
  "ASC_KEY_ID",
  "ASC_ISSUER_ID",
  "ASC_PRIVATE_KEY",
  "ASC_APP_ID",
  "ASC_VERSION_STRING",
  "ASC_WHATS_NEW",
];

for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
}

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const PRIVATE_KEY = normalizePrivateKey(process.env.ASC_PRIVATE_KEY);
const APP_ID = process.env.ASC_APP_ID;
const VERSION = process.env.ASC_VERSION_STRING;
const WHATS_NEW = process.env.ASC_WHATS_NEW;
const RELEASE_TYPE = process.env.ASC_RELEASE_TYPE || "MANUAL";
const LOCALE = process.env.ASC_LOCALE || "en-US";
const BUILD_NUMBER = process.env.ASC_BUILD_NUMBER || null;
const API = "https://api.appstoreconnect.apple.com/v1";

function normalizePrivateKey(value) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return trimmed.replaceAll("\\n", "\n");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
    if (decoded.includes("BEGIN PRIVATE KEY")) {
      return decoded.replaceAll("\\n", "\n");
    }
  } catch {
    // Fall back to the original value below.
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

const token = buildJwt();

async function asc(method, apiPath, body) {
  const response = await fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`ASC ${method} ${apiPath} -> ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function findProcessedBuild() {
  const filter = new URLSearchParams({
    "filter[app]": APP_ID,
    "filter[preReleaseVersion.version]": VERSION,
    "filter[processingState]": "VALID",
    sort: "-version",
    limit: "20",
  });

  if (BUILD_NUMBER) {
    filter.set("filter[version]", BUILD_NUMBER);
  }

  const data = await asc("GET", `/builds?${filter.toString()}`);
  if (!data.data?.length) {
    throw new Error(`No processed build found for ${VERSION}${BUILD_NUMBER ? ` build ${BUILD_NUMBER}` : ""}.`);
  }
  return data.data[0];
}

async function findOrCreateVersion(buildId) {
  const params = new URLSearchParams({
    "filter[versionString]": VERSION,
    "filter[platform]": "IOS",
    limit: "1",
  });

  const list = await asc("GET", `/apps/${APP_ID}/appStoreVersions?${params.toString()}`);
  if (list.data?.length) {
    return list.data[0];
  }

  const created = await asc("POST", "/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: {
        platform: "IOS",
        versionString: VERSION,
        releaseType: RELEASE_TYPE,
      },
      relationships: {
        app: { data: { type: "apps", id: APP_ID } },
        build: { data: { type: "builds", id: buildId } },
      },
    },
  });

  return created.data;
}

async function attachBuild(versionId, buildId) {
  await asc("PATCH", `/appStoreVersions/${versionId}`, {
    data: {
      type: "appStoreVersions",
      id: versionId,
      relationships: {
        build: { data: { type: "builds", id: buildId } },
      },
    },
  });
}

async function setWhatsNew(versionId) {
  const localizations = await asc(
    "GET",
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
  );
  const existing = localizations.data?.find((localization) => localization.attributes?.locale === LOCALE);

  if (existing) {
    await asc("PATCH", `/appStoreVersionLocalizations/${existing.id}`, {
      data: {
        type: "appStoreVersionLocalizations",
        id: existing.id,
        attributes: { whatsNew: WHATS_NEW },
      },
    });
    return existing.id;
  }

  const created = await asc("POST", "/appStoreVersionLocalizations", {
    data: {
      type: "appStoreVersionLocalizations",
      attributes: { locale: LOCALE, whatsNew: WHATS_NEW },
      relationships: {
        appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
      },
    },
  });
  return created.data.id;
}

async function ensureReviewSubmission(versionId) {
  const existing = await asc(
    "GET",
    `/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW`,
  );

  let submissionId;
  if (existing.data?.length) {
    submissionId = existing.data[0].id;
  } else {
    const created = await asc("POST", "/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    });
    submissionId = created.data.id;
  }

  const items = await asc("GET", `/reviewSubmissions/${submissionId}/items?limit=50`);
  const alreadyAttached = items.data?.some(
    (item) => item.relationships?.appStoreVersion?.data?.id === versionId,
  );

  if (!alreadyAttached) {
    await asc("POST", "/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
          appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
        },
      },
    });
  }

  await asc("PATCH", `/reviewSubmissions/${submissionId}`, {
    data: {
      type: "reviewSubmissions",
      id: submissionId,
      attributes: { submitted: true },
    },
  });

  return submissionId;
}

const build = await findProcessedBuild();
console.log(`Using build ${build.attributes.version} (${build.id}) for ${VERSION}.`);

const version = await findOrCreateVersion(build.id);
console.log(`App Store version ${VERSION} -> ${version.id}.`);

await attachBuild(version.id, build.id);
await setWhatsNew(version.id);
const submissionId = await ensureReviewSubmission(version.id);
console.log(`Submitted version ${VERSION} for review (submission ${submissionId}).`);
