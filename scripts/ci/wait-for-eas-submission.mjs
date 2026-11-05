#!/usr/bin/env node
// Waits for an EAS build and its auto-submit upload to App Store Connect, and
// fails with EAS's own error the moment either one fails. Without this the
// release only polls App Store Connect, so an upload Apple rejected looks like
// slow processing for an hour before it fails with no reason.

const BUILD_ID = process.env.EAS_BUILD_ID;
const TOKEN = process.env.EXPO_TOKEN;
const WAIT_ATTEMPTS = Number.parseInt(process.env.EAS_WAIT_ATTEMPTS || "120", 10);
const WAIT_SECONDS = Number.parseInt(process.env.EAS_WAIT_SECONDS || "30", 10);
const FAILED = new Set(["ERRORED", "CANCELED"]);

if (!BUILD_ID || !TOKEN) {
  console.error("Missing required env: EAS_BUILD_ID and EXPO_TOKEN");
  process.exit(1);
}

const QUERY = `query BuildSubmission($id: ID!) {
  builds {
    byId(buildId: $id) {
      status
      error { errorCode message }
      submissions { id status error { errorCode message } }
    }
  }
}`;

const HINTS = {
  EAS_UPLOAD_TO_ASC_CLOSED_VERSION_TRAIN:
    "This version is already live on the App Store. Bump expo.version in apps/mobile/app.json " +
    "(and version in apps/mobile/package.json and its lockfile) to the next patch, merge, and release again.",
};

async function fetchBuild() {
  const response = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query: QUERY, variables: { id: BUILD_ID } }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(`EAS API ${response.status}: ${JSON.stringify(body.errors || body)}`);
  }
  return body.data.builds.byId;
}

function fail(what, error) {
  const code = error?.errorCode ? ` [${error.errorCode}]` : "";
  console.error(`EAS ${what} failed${code}: ${error?.message || "no reason given"}`);
  if (error?.errorCode && HINTS[error.errorCode]) {
    console.error(`Fix: ${HINTS[error.errorCode]}`);
  }
  process.exit(1);
}

for (let attempt = 1; attempt <= WAIT_ATTEMPTS; attempt += 1) {
  const build = await fetchBuild();
  if (FAILED.has(build.status)) fail("build", build.error);

  const submission = build.submissions?.[0];
  if (submission && FAILED.has(submission.status)) fail("App Store Connect upload", submission.error);
  if (submission?.status === "FINISHED") {
    console.log(`EAS build ${BUILD_ID} uploaded to App Store Connect (submission ${submission.id}).`);
    process.exit(0);
  }

  console.log(`Waiting for EAS: build ${build.status}, upload ${submission?.status || "not scheduled"}.`);
  if (attempt < WAIT_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, WAIT_SECONDS * 1000));
}

console.error(`EAS build ${BUILD_ID} did not finish uploading within ${(WAIT_ATTEMPTS * WAIT_SECONDS) / 60} minutes.`);
process.exit(1);
