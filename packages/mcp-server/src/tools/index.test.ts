import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient } from "../client.js";
import { allTools, handleToolCall, toolGroups, toolHandlerRegistry } from "./index.js";

test("every advertised tool has exactly its owning module handler", () => {
  const advertisedNames = allTools.map((tool) => tool.name);
  assert.equal(new Set(advertisedNames).size, advertisedNames.length);
  assert.equal(toolHandlerRegistry.size, advertisedNames.length);

  for (const [tools, handler] of toolGroups) {
    for (const tool of tools) {
      assert.equal(toolHandlerRegistry.get(tool.name), handler, tool.name);
    }
  }
});

test("invalid tool arguments cannot reach the API", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("{}"));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  for (const [name, args] of [
    ["niftygifty_get_gift", { gift_id: "../people" }],
    ["niftygifty_delete_gift", {}],
    ["niftygifty_create_gift", { holiday_id: "invalid", name: "Gift" }],
  ] as const) {
    const response = await handleToolCall(client, name, args);
    assert.equal(response.isError, true);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("valid tool arguments still dispatch successfully", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response('{"id":1}'));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  const response = await handleToolCall(client, "niftygifty_get_gift", { gift_id: 1 });
  assert.notEqual(response.isError, true);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(fetch.mock.calls[0].arguments[0], "https://example.com/gifts/1");
});
