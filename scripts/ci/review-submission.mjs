// App Store Connect review state transitions, separated for credential-free tests.
export function assertEditableVersion(version) {
  const state = version.attributes.appStoreState;
  if (!["PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW", "REJECTED", "METADATA_REJECTED", "DEVELOPER_REJECTED"].includes(state)) {
    throw new Error(`Version ${version.id} is ${state}; refusing to change a version already submitted or released.`);
  }
}

export async function isInitialRelease(asc, appId, versionId) {
  const versions = await asc("GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=200`);
  // A new app can have several rejected versions before its first release.
  const releasedStates = new Set(["READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "REMOVED_FROM_SALE", "REMOVED_FROM_DISTRIBUTION", "DEVELOPER_REMOVED_FROM_SALE", "DEVELOPER_REMOVED_FROM_DISTRIBUTION", "REPLACED_WITH_NEW_VERSION"]);
  if (versions.links?.next) throw new Error("Version history is paginated; verify the initial-release status before promotion.");
  return !versions.data.some((version) => version.id !== versionId && (version.attributes.downloadable || releasedStates.has(version.attributes.appStoreState)));
}

export async function ensureReviewSubmission(asc, appId, versionId) {
  const existing = await asc("GET", `/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
  if (existing.data.length > 1) throw new Error("Multiple active iOS submissions; resolve them before promotion.");
  let submission = existing.data[0];
  if (submission && !["READY_FOR_REVIEW", "UNRESOLVED_ISSUES"].includes(submission.attributes.state)) {
    throw new Error(`Submission ${submission.id} is already ${submission.attributes.state}.`);
  }
  if (!submission) {
    submission = (await asc("POST", "/reviewSubmissions", {
      data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: appId } } } },
    })).data;
  }
  const items = await asc("GET", `/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=50`);
  const versionItem = items.data.find((item) => item.relationships?.appStoreVersion?.data?.id === versionId && item.attributes.state !== "REMOVED");
  if (items.data.some((item) => item.id !== versionItem?.id && item.attributes.state === "REJECTED")) {
    throw new Error("Other rejected review items still need attention; refusing to resolve them automatically.");
  }
  if (versionItem?.attributes.state === "REJECTED") {
    await asc("PATCH", `/reviewSubmissionItems/${versionItem.id}`, {
      data: { type: "reviewSubmissionItems", id: versionItem.id, attributes: { resolved: true } },
    });
  } else if (!versionItem) {
    if (submission.attributes.state === "UNRESOLVED_ISSUES") throw new Error("The rejected submission does not contain this app version.");
    await asc("POST", "/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
          appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
        },
      },
    });
  }
  await asc("PATCH", `/reviewSubmissions/${submission.id}`, {
    data: { type: "reviewSubmissions", id: submission.id, attributes: { submitted: true } },
  });
  return submission.id;
}
