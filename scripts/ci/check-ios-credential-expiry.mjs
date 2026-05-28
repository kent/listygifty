#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const appConfigPath = path.resolve(
  repoRoot,
  process.env.MOBILE_APP_CONFIG_PATH || "apps/mobile/app.json",
);

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_DAYS = parsePositiveInt(process.env.IOS_CREDENTIAL_EXPIRY_WARN_DAYS, 90);
const FAIL_DAYS = parsePositiveInt(process.env.IOS_CREDENTIAL_EXPIRY_FAIL_DAYS, 30);
const IOS_DISTRIBUTION_TYPE = process.env.IOS_DISTRIBUTION_TYPE || "APP_STORE";

function parsePositiveInt(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadExpoConfig() {
  const config = JSON.parse(fs.readFileSync(appConfigPath, "utf8"));
  if (!config.expo) {
    throw new Error(`${appConfigPath} does not contain an expo config object.`);
  }
  return config.expo;
}

function getExpoProjectFullName(expo) {
  if (process.env.EXPO_PROJECT_FULL_NAME) {
    return process.env.EXPO_PROJECT_FULL_NAME;
  }
  if (!expo.owner || !expo.slug) {
    throw new Error("Missing Expo owner/slug. Set EXPO_PROJECT_FULL_NAME for the credential preflight.");
  }
  return `@${expo.owner}/${expo.slug}`;
}

function getIosBundleIdentifier(expo) {
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || expo.ios?.bundleIdentifier;
  if (!bundleIdentifier) {
    throw new Error("Missing expo.ios.bundleIdentifier. Set IOS_BUNDLE_IDENTIFIER for the credential preflight.");
  }
  return bundleIdentifier;
}

function getAuthHeaders() {
  if (process.env.EXPO_TOKEN) {
    return { authorization: `Bearer ${process.env.EXPO_TOKEN}` };
  }

  if (process.env.CI) {
    throw new Error("EXPO_TOKEN is required to validate EAS iOS credential expiry in CI.");
  }

  const statePath = path.join(os.homedir(), ".expo", "state.json");
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const sessionSecret = state.auth?.sessionSecret;
    if (sessionSecret) {
      return { "expo-session": sessionSecret };
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  throw new Error("Expo authentication is required. Set EXPO_TOKEN or run eas login locally.");
}

function getGraphqlUrl() {
  if (process.env.EXPO_GRAPHQL_URL) {
    return process.env.EXPO_GRAPHQL_URL;
  }
  if (process.env.EXPO_STAGING) {
    return "https://staging-api.expo.dev/graphql";
  }
  return "https://api.expo.dev/graphql";
}

async function expoGraphqlAsync(query, variables) {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18+ is required because this script uses global fetch.");
  }

  const response = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const responseText = await response.text();
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(`Expo GraphQL returned non-JSON response: ${responseText}`);
  }

  if (!response.ok || body.errors?.length) {
    const messages = body.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`Expo GraphQL credential query failed: ${messages}`);
  }

  return body.data;
}

async function fetchIosBuildCredentialsAsync({ projectFullName, bundleIdentifier }) {
  const query = `
    query IosCredentialExpiryPreflight($projectFullName: String!, $iosDistributionType: IosDistributionType!) {
      app {
        byFullName(fullName: $projectFullName) {
          id
          fullName
          iosAppCredentials {
            id
            appleAppIdentifier {
              id
              bundleIdentifier
            }
            iosAppBuildCredentialsList(filter: { iosDistributionType: $iosDistributionType }) {
              id
              iosDistributionType
              distributionCertificate {
                id
                serialNumber
                developerPortalIdentifier
                validityNotAfter
                appleTeam {
                  appleTeamIdentifier
                  appleTeamName
                }
              }
              provisioningProfile {
                id
                developerPortalIdentifier
                expiration
                status
                appleTeam {
                  appleTeamIdentifier
                  appleTeamName
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await expoGraphqlAsync(query, {
    projectFullName,
    iosDistributionType: IOS_DISTRIBUTION_TYPE,
  });

  const app = data?.app?.byFullName;
  if (!app) {
    throw new Error(`Expo project ${projectFullName} was not found.`);
  }

  const appCredentials = app.iosAppCredentials?.find(
    (credentials) => credentials.appleAppIdentifier?.bundleIdentifier === bundleIdentifier,
  );
  if (!appCredentials) {
    throw new Error(`No EAS iOS app credentials found for ${bundleIdentifier} in ${projectFullName}.`);
  }

  const buildCredentials = appCredentials.iosAppBuildCredentialsList?.[0];
  if (!buildCredentials) {
    throw new Error(`No ${IOS_DISTRIBUTION_TYPE} EAS iOS build credentials found for ${bundleIdentifier}.`);
  }

  return buildCredentials;
}

function daysUntil(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid credential expiry date: ${dateValue}`);
  }

  return {
    date,
    days: Math.ceil((date.getTime() - Date.now()) / DAY_MS),
  };
}

function githubAnnotation(kind, title, message) {
  console.log(`::${kind} title=${escapeGitHubCommandValue(title)}::${escapeGitHubCommandValue(message)}`);
}

function escapeGitHubCommandValue(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function describeCredential(label, identifier, expiryIso, days) {
  console.log(`- ${label}: ${identifier || "unknown"} expires ${expiryIso} (${days} days)`);
}

function validateExpiry(label, identifier, expiryValue) {
  const { date, days } = daysUntil(expiryValue);
  const expiryIso = date.toISOString();
  describeCredential(label, identifier, expiryIso, days);

  if (days <= FAIL_DAYS) {
    return {
      status: "fail",
      message: `${label} ${identifier || ""} expires in ${days} days on ${expiryIso}. Rotate it before queueing iOS store builds.`,
    };
  }

  if (days <= WARN_DAYS) {
    return {
      status: "warn",
      message: `${label} ${identifier || ""} expires in ${days} days on ${expiryIso}. Schedule rotation before the fail window.`,
    };
  }

  return { status: "ok" };
}

async function main() {
  const expo = loadExpoConfig();
  const projectFullName = getExpoProjectFullName(expo);
  const bundleIdentifier = getIosBundleIdentifier(expo);
  const projectId = expo.extra?.eas?.projectId;

  console.log("Checking EAS remote iOS signing credential expiry.");
  console.log(`- Project: ${projectFullName}${projectId ? ` (${projectId})` : ""}`);
  console.log(`- Bundle identifier: ${bundleIdentifier}`);
  console.log(`- Distribution type: ${IOS_DISTRIBUTION_TYPE}`);
  console.log(`- Warning window: ${WARN_DAYS} days`);
  console.log(`- Failure window: ${FAIL_DAYS} days`);

  const buildCredentials = await fetchIosBuildCredentialsAsync({
    projectFullName,
    bundleIdentifier,
  });

  const certificate = buildCredentials.distributionCertificate;
  const provisioningProfile = buildCredentials.provisioningProfile;
  if (!certificate?.validityNotAfter) {
    throw new Error("EAS iOS distribution certificate is missing an expiry date.");
  }
  if (!provisioningProfile?.expiration) {
    throw new Error("EAS iOS provisioning profile is missing an expiry date.");
  }
  if (provisioningProfile.status && provisioningProfile.status.toLowerCase() !== "active") {
    throw new Error(
      `EAS iOS provisioning profile ${provisioningProfile.developerPortalIdentifier || provisioningProfile.id} is ${provisioningProfile.status}.`,
    );
  }

  const results = [
    validateExpiry(
      "Distribution certificate",
      certificate.developerPortalIdentifier || certificate.serialNumber,
      certificate.validityNotAfter,
    ),
    validateExpiry(
      "Provisioning profile",
      provisioningProfile.developerPortalIdentifier,
      provisioningProfile.expiration,
    ),
  ];

  const failures = results.filter((result) => result.status === "fail");
  const warnings = results.filter((result) => result.status === "warn");

  for (const warning of warnings) {
    githubAnnotation("warning", "iOS credential expiry approaching", warning.message);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      githubAnnotation("error", "iOS credential expiry blocks release", failure.message);
    }
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    console.log("EAS remote iOS signing credentials are usable, but rotation should be scheduled.");
    return;
  }

  console.log("EAS remote iOS signing credentials are inside the allowed expiry window.");
}

main().catch((error) => {
  githubAnnotation("error", "iOS credential expiry preflight failed", error.message);
  process.exitCode = 1;
});
