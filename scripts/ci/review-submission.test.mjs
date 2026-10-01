import assert from "node:assert/strict";
import { test } from "node:test";
import { assertEditableVersion, ensureReviewSubmission, isInitialRelease } from "./review-submission.mjs";

const versionItem = (state = "REJECTED") => ({ id: "item", attributes: { state }, relationships: { appStoreVersion: { data: { id: "version" } } } });
function api(responses) {
  const calls = [];
  const request = async (...args) => {
    calls.push(args);
    assert.ok(responses.length, `Unexpected request ${args[0]} ${args[1]}`);
    return responses.shift();
  };
  return { request, calls };
}

test("resubmits a fixed rejected version in its existing submission", async () => {
  const { request, calls } = api([
    { data: [{ id: "submission", attributes: { state: "UNRESOLVED_ISSUES" } }] },
    { data: [versionItem()] }, {}, {},
  ]);
  assert.equal(await ensureReviewSubmission(request, "app", "version"), "submission");
  assert.match(calls[0][1], /UNRESOLVED_ISSUES/);
  assert.deepEqual(calls[2], ["PATCH", "/reviewSubmissionItems/item", { data: { type: "reviewSubmissionItems", id: "item", attributes: { resolved: true } } }]);
  assert.equal(calls[3][2].data.attributes.submitted, true);
  assert.equal(calls.filter(([method]) => method === "POST").length, 0);
});

test("creates and submits a new review when none exists", async () => {
  const { request, calls } = api([{ data: [] }, { data: { id: "new", attributes: { state: "READY_FOR_REVIEW" } } }, { data: [] }, {}, {}]);
  assert.equal(await ensureReviewSubmission(request, "app", "version"), "new");
  assert.equal(calls[1][1], "/reviewSubmissions");
  assert.equal(calls[3][2].data.relationships.appStoreVersion.data.id, "version");
});

test("does not resolve other rejected items or modify a submission in review", async () => {
  const other = { ...versionItem(), id: "other", relationships: {} };
  const { request, calls } = api([{ data: [{ id: "submission", attributes: { state: "UNRESOLVED_ISSUES" } }] }, { data: [versionItem(), other] }]);
  await assert.rejects(ensureReviewSubmission(request, "app", "version"), /Other rejected/);
  assert.equal(calls.length, 2);
  const inReview = api([{ data: [{ id: "submission", attributes: { state: "IN_REVIEW" } }] }]);
  await assert.rejects(ensureReviewSubmission(inReview.request, "app", "version"), /already IN_REVIEW/);
  assert.equal(inReview.calls.length, 1);
});

test("recognizes the first release even after earlier rejected versions", async () => {
  const versions = [{ id: "version", attributes: { appStoreState: "REJECTED" } }, { id: "older", attributes: { appStoreState: "DEVELOPER_REJECTED" } }];
  assert.equal(await isInitialRelease(api([{ data: versions }]).request, "app", "version"), true);
  versions.push({ id: "released", attributes: { appStoreState: "READY_FOR_DISTRIBUTION" } });
  assert.equal(await isInitialRelease(api([{ data: versions }]).request, "app", "version"), false);
});

test("rejects editing submitted or released versions before any mutations", () => {
  for (const appStoreState of ["IN_REVIEW", "WAITING_FOR_REVIEW", "READY_FOR_SALE"]) {
    assert.throws(() => assertEditableVersion({ id: "version", attributes: { appStoreState } }), /refusing to change/);
  }
  assert.doesNotThrow(() => assertEditableVersion({ id: "version", attributes: { appStoreState: "REJECTED" } }));
});
