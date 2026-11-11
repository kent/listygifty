import { expect, test } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { acceptInvite, api, seedExchange, signedIn } from "../support/api";
import { allowClerkTestSession, enterCode, signInThroughForm, waitUntilSignedIn } from "../support/clerk-ui";
import { Journey, action, openSession } from "../support/harness";
import { clearMail, resetLocalData, rows } from "../support/local";

const [owner, parker] = E2E_USERS;

test("fixes found late: each one proven in a real browser", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("r1-regressions", "busy-parent", "Prove the late fixes in a real browser.", testInfo);
  const organizer = await openSession(browser, journey, { role: "owner" });
  const guest = await openSession(browser, journey, { phone: true });
  const relative = await openSession(browser, journey, { role: "participant-1" });
  const page = organizer.page;
  await signedIn(page);
  await signedIn(relative.page);

  type List = { id: number };
  const created = await api<List>(page, "POST", "/wishlists", {
    wishlist: { name: "My birthday", visibility: "shared" },
  });
  const listId = created.body.id;
  await api(page, "POST", `/wishlists/${listId}/wishlist_items`, { wishlist_item: { name: "Pasta machine" } });
  const shared = await api<{ share_url: string }>(page, "POST", `/wishlists/${listId}/share`);
  const shareUrl = shared.body.share_url;
  const token = new URL(shareUrl).pathname.split("/").pop();
  const item = rows<{ id: number }>("SELECT id FROM wishlist_items WHERE name = 'Pasta machine'")[0];

  await journey.step("A guest's claim button says what it does on a phone", guest.page, async () => {
    await guest.page.goto(shareUrl);
    await expect(guest.page.getByText("Claim This").first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.page.getByText("1 item", { exact: true })).toBeVisible();
  });

  await fetch(`http://localhost:3001/w/${token}/items/${item.id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim: { claimer_name: "Cousin Sam", claimer_email: "cousin.guest@example.com", quantity: 1 } }),
  });

  await journey.step("A guest still sees that it was claimed", guest.page, async () => {
    await guest.page.reload();
    await expect(guest.page.getByText("Claimed", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  await journey.step("The owner's own share link keeps the surprise", page, async () => {
    await page.goto(shareUrl);
    await expect(page.getByText(/This is your wishlist/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Pasta machine").first()).toBeVisible();
    await expect(page.getByText("Claimed", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Claim this/ })).toHaveCount(0);
  });

  const exchange = await seedExchange(page, "Live Test", [{ name: "Parker Participant", email: parker.email }]);

  await journey.step("An open exchange page updates by itself when someone joins", page, async () => {
    await page.goto(`/exchanges/${exchange.slug}`);
    await expect(page.getByText("1/2 joined")).toBeVisible({ timeout: 15_000 });
    await acceptInvite(relative.page, parker.email);
    await expect(page.getByText("2/2 joined")).toBeVisible({ timeout: 25_000 });
    await expect(action(page, /Draw names/)).toBeVisible();
  });

  await journey.step("Home's checklist shows what was just added", page, async () => {
    await api(page, "POST", "/people", { person: { name: "Maya" } });
    await action(page, /Listy Gifty home/).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("1/3").first()).toBeVisible({ timeout: 15_000 });
  });

  await journey.step("Enter saves a gift name and closes the box", page, async () => {
    const list = await api<List>(page, "POST", "/holidays", { holiday: { name: "Rename test" } });
    const status = rows<{ id: number }>("SELECT id FROM gift_statuses ORDER BY position LIMIT 1")[0];
    await api(page, "POST", "/gifts", { gift: { name: "Golf balls", holiday_id: list.body.id, gift_status_id: status.id } });
    await page.goto(`/holidays/${list.body.id}`);
    if (testInfo.project.use.isMobile) {
      await page.locator('[data-slot="card"]').filter({ hasText: "Golf balls" }).first().getByRole("button").first().click();
    }
    await page.getByRole("button", { name: /Rename gift/ }).locator("visible=true").first().click();
    const box = page.locator('input[placeholder="Gift name..."]');
    await box.fill("Golf balls (Pro V1)");
    await page.keyboard.press("Enter");
    await expect(box).toHaveCount(0);
    await expect(page.getByText("Golf balls (Pro V1)").locator("visible=true").first()).toBeVisible();
  });

  const stranger = await openSession(browser, journey, { phone: true });
  await allowClerkTestSession(stranger.page);

  await journey.step("If a sign-in code fails, reloading and retyping it gets you in", stranger.page, async () => {
    let failed = 0;
    await stranger.page.route("**/attempt_first_factor*", async (route) => {
      if (failed > 0) return route.fallback();
      failed += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ code: "form_code_incorrect", message: "Incorrect code", long_message: "Incorrect code" }] }),
      });
    });
    await stranger.page.goto("/login");
    await signInThroughForm(stranger.page, owner.email);
    await expect.poll(() => failed).toBe(1);
    await stranger.page.reload();
    await enterCode(stranger.page);
    await waitUntilSignedIn(stranger.page);
    await expect(stranger.page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  for (const session of [organizer, guest, relative, stranger]) await session.context.close();
  journey.finish();
});
