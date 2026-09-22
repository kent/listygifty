import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient } from "./client.js";
import { handleResourceRead } from "./resources/index.js";

test("upcoming resources exclude past, archived, and undated holidays", async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  const holidays = [
    { id: 1, date: "2000-01-01", archived: false },
    { id: 2, date: "2099-12-25", archived: false },
    { id: 3, date: today, archived: false },
    { id: 4, date: "2099-12-26", archived: true },
    { id: 5, date: null, archived: false },
  ];
  t.mock.method(globalThis, "fetch", async (url: unknown) => new Response(JSON.stringify(String(url).endsWith("/holidays") ? holidays : {})));
  const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" });
  for (const uri of ["niftygifty://holidays/upcoming", "niftygifty://dashboard/overview"]) {
    const result = await handleResourceRead(client, uri);
    const resource = result.contents[0];
    assert.ok("text" in resource);
    const content = JSON.parse(resource.text);
    const upcoming = Array.isArray(content) ? content : content.upcoming_holidays;
    assert.deepEqual(upcoming.map((holiday: { id: number }) => holiday.id), [3, 2]);
  }
});

test("pending gifts exclude the canonical final status, including renamed statuses", async (t) => {
  const gifts = [
    { id: 1, gift_status_id: 1, gift_status: { name: "Idea" } },
    { id: 2, gift_status_id: 2, gift_status: { name: "Done" } },
    { id: 3, gift_status_id: 3, gift_status: { name: "All wrapped up" } },
  ];
  const statuses = [{ id: 1, position: 0 }, { id: 2, position: 5 }, { id: 3, position: 5 }];
  t.mock.method(globalThis, "fetch", async (url: unknown) => new Response(JSON.stringify(String(url).endsWith("/gift_statuses") ? statuses : gifts)));
  const result = await handleResourceRead(new ApiClient({ baseUrl: "https://example.com", apiKey: "test-key" }), "niftygifty://gifts/pending");
  const resource = result.contents[0];
  assert.ok("text" in resource);
  assert.deepEqual(JSON.parse(resource.text).map((gift: { id: number }) => gift.id), [1]);
});
