import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClient, ApiError } from "@niftygifty/api-client";
import { createWishlistItemsService } from "../dist/wishlist-items.service.js";
import { createGiftsService } from "../dist/gifts.service.js";
import { createExchangeJoinsService } from "../dist/exchange-joins.service.js";

function client() {
  const api = new ApiClient({ baseUrl: "https://api.example.test" });
  api.setTokenGetter(async () => "test-token");
  api.setWorkspaceId(3);
  return api;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

test("photo uploads retain structured validation errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json({ errors: ["Photo is too large"] }, 422));
  await assert.rejects(createWishlistItemsService(client()).uploadPhoto(1, 2, 3, new FormData()),
    (error) => error instanceof ApiError && error.status === 422 && error.message.includes("Photo is too large"));
});

test("photo uploads use authenticated multipart without overriding the generated boundary", async (t) => {
  const photo = new FormData();
  photo.append("photo", new Blob(["image"], { type: "image/png" }), "gift.png");
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ id: 3 }));
  assert.deepEqual(await createWishlistItemsService(client()).uploadPhoto(1, 2, 3, photo), { id: 3 });
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.example.test/gift_exchanges/1/exchange_participants/2/exchange_wishlist_items/3");
  assert.equal(options.method, "PATCH");
  assert.equal(options.body, photo);
  assert.equal(options.headers.Authorization, "Bearer test-token");
  assert.equal(options.headers["X-Workspace-ID"], "3");
  assert.equal(options.headers["Content-Type"], undefined);
  assert.ok(options.signal instanceof AbortSignal);
});

test("gift mutations retain zero costs and explicit address clearing in their API envelopes", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ id: 4 }));
  const gifts = createGiftsService(client());
  await gifts.update(4, { cost: 0, description: "" });
  await gifts.updateRecipientAddress(4, 5, null);
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), { gift: { cost: 0, description: "" } });
  assert.deepEqual(JSON.parse(fetch.mock.calls[1].arguments[1].body), { gift_recipient: { shipping_address_id: null } });
});

test("exchange joins encode share tokens and normalize optional names", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({}));
  const joins = createExchangeJoinsService(client());
  await joins.getDetails("a/b?query");
  await joins.join("invite", "  Guest  ");
  assert.equal(fetch.mock.calls[0].arguments[0], "https://api.example.test/exchange_join/a%2Fb%3Fquery");
  assert.deepEqual(JSON.parse(fetch.mock.calls[1].arguments[1].body), { name: "Guest" });
});

test("anonymous wishlist requests preserve the server's cooldown feedback", async (t) => {
  const { createGiftExchangesService } = await import("../dist/gift-exchanges.service.js");
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ error: "Your anonymous request was already sent in the last 24 hours" }, 422));
  await assert.rejects(createGiftExchangesService(client()).nudgeMatch(32), (error) => error.status === 422 && error.message.includes("24 hours"));
  assert.equal(fetch.mock.calls[0].arguments[0], "https://api.example.test/gift_exchanges/32/nudge_match");
  assert.equal(fetch.mock.calls[0].arguments[1].method, "POST");
});

test("reinviting a participant uses the authenticated resend endpoint", async (t) => {
  const { createExchangeParticipantsService } = await import("../dist/exchange-participants.service.js");
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ message: "Invitation resent" }));
  await createExchangeParticipantsService(client()).resendInvite(32, 123);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.example.test/gift_exchanges/32/exchange_participants/123/resend_invite");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer test-token");
});
