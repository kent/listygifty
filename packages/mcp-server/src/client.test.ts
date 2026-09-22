import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient, ApiError } from "./client.js";
import { handleExportTool } from "./tools/exports.js";

test("CSV export tools preserve the server's plain-text response", async (t) => {
  const csv = "name,cost\nGift,20.00\n";
  t.mock.method(globalThis, "fetch", async () => new Response(csv, { headers: { "Content-Type": "text/csv" } }));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  for (const name of ["niftygifty_export_gifts_csv", "niftygifty_export_people_csv"]) {
    const result = await handleExportTool(client, name, { holiday_id: 1 }) as { data: string };
    assert.equal(result.data, csv);
  }
});

test("JSON false, zero, and null request bodies are sent", async (t) => {
  const bodies: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    bodies.push(options.body);
    return new Response("{}");
  });
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  for (const value of [false, 0, null]) await client.post("/value", value);
  assert.deepEqual(bodies, ["false", "0", "null"]);
});

test("malformed API errors preserve their HTTP status", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 422 }));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  await assert.rejects(client.post("/gifts", {}), (error) => error instanceof ApiError && error.status === 422);
});

test("a deadline covers response parsing", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) as Response);
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  const outcome = await Promise.race([
    client.get("/gifts", { timeout: 10, retries: 0 }).catch((error: unknown) => error),
    new Promise<string>((resolve) => setTimeout(() => resolve("deadline missed"), 200)),
  ]);
  assert.ok(outcome instanceof ApiError && outcome.status === 0);
});

test("multipart uploads accept empty success responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  assert.deepEqual(await client.postFormData("/imports/people", new FormData()), {});
});

test("invalid request options fail before making a request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("{}"));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  await assert.rejects(client.get("/gifts", { retries: -1 }), /retries/);
  await assert.rejects(client.get("/gifts", { timeout: 0 }), /timeout/);
  assert.equal(fetch.mock.callCount(), 0);
});
