import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { ApiClient, ApiError } from "../dist/index.js";

function client() {
  return new ApiClient({ baseUrl: "https://api.example.test" });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

test("does not start an already-cancelled request", async (t) => {
  const controller = new AbortController();
  controller.abort();
  const fetch = t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    signal.throwIfAborted();
    return json({});
  });
  await assert.rejects(client().get("/people", { signal: controller.signal, retries: 0 }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("does not retry user cancellation or report it as a timeout", async (t) => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    controller.abort();
    throw controller.signal.reason;
  });
  await assert.rejects(client().get("/people", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 1);
});

test("cancellation interrupts retry backoff", async (t) => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    setTimeout(() => controller.abort(), 10);
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(client().get("/people", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 1);
});

test("enforces timeouts with external signals even without AbortSignal.any", async (t) => {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, "any");
  Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
  t.after(() => Object.defineProperty(AbortSignal, "any", original));
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    await delay(60, undefined, { signal });
    return json({});
  });
  await assert.rejects(client().get("/people", {
    signal: new AbortController().signal, timeout: 10, retries: 0,
  }), (error) => error instanceof ApiError && error.isTimeout);
});

test("keeps the timeout active while reading a response body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true, status: 200, json: () => delay(60, { people: [] }),
  }));
  await assert.rejects(client().get("/people", { timeout: 10, retries: 0 }),
    (error) => error instanceof ApiError && error.isTimeout);
});

test("bounds token lookup and never sends a request after lookup times out", async (t) => {
  const api = client();
  api.setTokenGetter(() => delay(60, "token"));
  const fetch = t.mock.method(globalThis, "fetch", async () => json({}));
  await assert.rejects(api.get("/people", { timeout: 10, retries: 0 }),
    (error) => error instanceof ApiError && error.isTimeout);
  await delay(70);
  assert.equal(fetch.mock.callCount(), 0);
});

test("captures workspace selection before asynchronous token lookup", async (t) => {
  const api = client();
  api.setWorkspaceId(1);
  api.setTokenGetter(() => delay(10, "token"));
  const fetch = t.mock.method(globalThis, "fetch", async () => json({}));
  const request = api.get("/people");
  api.setWorkspaceId(2);
  await request;
  assert.equal(fetch.mock.calls[0].arguments[1].headers["X-Workspace-ID"], "1");
});

test("retains valid false, zero and null JSON bodies", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({}));
  const api = client();
  for (const value of [false, 0, null]) await api.post("/value", value);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: args }) => args[1].body), ["false", "0", "null"]);
});

test("preserves HTTP status for malformed error payloads", async (t) => {
  const responses = [json(null, 401), json({ errors: {} }, 422), new Response("upstream unavailable", { status: 503 })];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  for (const status of [401, 422, 503]) {
    await assert.rejects(client().get("/people", { retries: 0 }),
      (error) => error instanceof ApiError && error.status === status && Boolean(error.message));
  }
});

test("multipart uploads use timeout, authentication, and workspace handling", async (t) => {
  const api = client();
  api.setTokenGetter(async () => "token");
  api.setWorkspaceId(7);
  const body = new FormData();
  body.set("name", "Photo");
  const fetch = t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    await delay(60, undefined, { signal });
    return json({});
  });
  await assert.rejects(api.postFormData("/photos", body, { timeout: 10 }),
    (error) => error instanceof ApiError && error.isTimeout);
  const config = fetch.mock.calls[0].arguments[1];
  assert.equal(config.headers.Authorization, "Bearer token");
  assert.equal(config.headers["X-Workspace-ID"], "7");
  assert.equal(config.headers["Content-Type"], undefined);
  assert.equal(config.body, body);
  assert.equal(fetch.mock.callCount(), 1);
});

test("multipart uploads accept no-content responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  await client().patchFormData("/photos/1", new FormData());
});

test("retries a failed GET but does not duplicate failed mutations", async (t) => {
  let responses = [json({ error: "Unavailable" }, 503), json({ id: 1 })];
  const fetch = t.mock.method(globalThis, "fetch", async () => responses.shift());
  assert.deepEqual(await client().get("/people", { retries: 1 }), { id: 1 });
  assert.equal(fetch.mock.callCount(), 2);
  responses = [json({ error: "Unavailable" }, 503)];
  await assert.rejects(client().post("/people", {}), { status: 503 });
  assert.equal(fetch.mock.callCount(), 3);
});

test("rejects invalid retry and timeout options without calling fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({}));
  for (const options of [{ retries: -1 }, { retries: NaN }, { timeout: -1 }, { timeout: Infinity }]) {
    await assert.rejects(client().get("/people", options), { name: "RangeError" });
  }
  assert.equal(fetch.mock.callCount(), 0);
});


test("file downloads preserve content, response headers and workspace authentication", async (t) => {
  const api = client();
  api.setWorkspaceId(12);
  api.setTokenGetter(async () => "file-token");
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("name,cost\nGift,0", {
    headers: { "Content-Disposition": 'attachment; filename="gifts.csv"', "Content-Type": "text/csv" },
  }));
  const result = await api.getBlob("/exports/gifts", { retries: 0 });
  assert.equal(await result.blob.text(), "name,cost\nGift,0");
  assert.equal(result.headers.get("Content-Disposition"), 'attachment; filename="gifts.csv"');
  assert.equal(fetch.mock.calls[0].arguments[1].headers["X-Workspace-ID"], "12");
  assert.equal(fetch.mock.calls[0].arguments[1].headers.Authorization, "Bearer file-token");
});

test("file downloads enforce the deadline through an unresponsive body read", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200, blob: () => new Promise(() => {}) }));
  await assert.rejects(client().getBlob("/exports/people", { retries: 0, timeout: 10 }),
    (error) => error instanceof ApiError && /timeout/.test(error.message));
});
