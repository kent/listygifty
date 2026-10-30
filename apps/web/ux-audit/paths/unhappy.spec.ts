import { expect, test } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { acceptInvite, api, inviteToken, seedExchange, signedIn } from "../support/api";
import { allowClerkTestSession, signInThroughForm, waitUntilSignedIn } from "../support/clerk-ui";
import { Journey, action, openSession, shown } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const [organizer, parker, quinn, riley] = E2E_USERS;
const asInvitee = (user: (typeof E2E_USERS)[number]) => ({ name: `${user.firstName} ${user.lastName}`, email: user.email });

test("unhappy paths: when things go wrong, people can tell what to do", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("u1-unhappy-paths", "new-relative", "Walk every way an exchange or sign-in goes wrong.", testInfo);

  const owner = await openSession(browser, journey, { role: "owner" });
  const parkerSession = await openSession(browser, journey, { role: "participant-1" });
  const quinnSession = await openSession(browser, journey, { role: "participant-2" });
  const rileySession = await openSession(browser, journey, { role: "participant-3" });
  const stranger = await openSession(browser, journey, { phone: true });
  await allowClerkTestSession(stranger.page);

  const page = owner.page;
  await signedIn(page);
  await signedIn(parkerSession.page);
  await signedIn(quinnSession.page);
  await signedIn(rileySession.page);

  await journey.step("Empty exchanges page says how to start", page, async () => {
    await page.goto("/exchanges");
    await expect(action(page, /Create Your First Exchange/)).toBeVisible();
  });

  await journey.step("Empty gift lists page says how to start", page, async () => {
    await page.goto("/holidays");
    await expect(action(page, /New Gift List|Start|Create/)).toBeVisible();
    await expect(page.getByText(/no .*gift lists|start planning|get started/i).first()).toBeVisible();
  });

  await journey.step("Empty people page says how to start", page, async () => {
    await page.goto("/people");
    await expect(page.getByText(/no people/i).first()).toBeVisible();
    await expect(action(page, /Add|New/)).toBeVisible();
  });

  await journey.step("Empty wishlists page says how to start", page, async () => {
    await page.goto("/wishlists");
    await expect(action(page, /Create Your First Wishlist/)).toBeVisible();
  });

  const solo = await seedExchange(page, "Solo Test", []);

  await journey.step("Alone in an exchange, I am told why I can't draw yet", page, async () => {
    await page.goto(`/exchanges/${solo.slug}`);
    await expect(page.getByRole("heading", { name: "Solo Test" })).toBeVisible();
    await expect(page.getByText(/(need|needs|at least|once|until).{0,40}(join|people|person)/i).first()).toBeVisible();
  });

  await journey.step("Going back mid-form keeps a new exchange from vanishing silently", page, async () => {
    await page.goto("/exchanges/new");
    await page.getByLabel("Exchange Name *").fill("Half finished");
    await page.reload();
    await expect(page.getByLabel("Exchange Name *")).toHaveValue("Half finished");
  });

  await journey.step("A made-up invite link explains what to do", stranger.page, async () => {
    await stranger.page.goto("/join/exchange/not-a-real-token");
    await expect(stranger.page.getByText(/ask .*(organi[sz]er|person|whoever)/i).first()).toBeVisible();
  });

  const extra = { name: "Extra Person", email: "extra.person@example.com" };
  const main = await seedExchange(page, "Main Test", [asInvitee(parker), asInvitee(quinn), asInvitee(riley), extra]);
  await acceptInvite(parkerSession.page, parker.email);

  await journey.step("Opening my invite twice just takes me to the exchange", parkerSession.page, async () => {
    await parkerSession.page.goto(`/join/exchange/${inviteToken(parker.email)}`);
    await expect(parkerSession.page.getByText("Already Joined!")).toBeVisible();
    await action(parkerSession.page, "Go to Exchange").click();
    await expect(parkerSession.page).toHaveURL(/\/exchanges\/main-test/);
  });

  await journey.step("Signed in with a different email, I am warned before taking the seat", quinnSession.page, async () => {
    await quinnSession.page.goto(`/join/exchange/${inviteToken(riley.email)}`);
    await expect(quinnSession.page.getByRole("heading", { name: "Main Test" })).toBeVisible();
    await expect(quinnSession.page.getByText(/sent to|invited .* at|different (email|account)/i).first()).toBeVisible();
  });

  await acceptInvite(quinnSession.page, quinn.email);

  await journey.step("Removing a person asks first", page, async () => {
    await page.goto(`/exchanges/${main.slug}`);
    const row = page.getByTestId("participant-roster").locator('[class*="rounded-lg"]').filter({ hasText: extra.email });
    await row.getByRole("button").last().click();
    await expect(page.getByRole("alertdialog").or(page.getByRole("dialog")).first()).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("Escape");
  });

  await journey.step("Impossible rules get an explanation I can act on", page, async () => {
    await page.goto(`/exchanges/${main.slug}`);
    const ids = (await api<Array<{ id: number; email: string }>>(page, "GET", `/gift_exchanges/${main.id}/exchange_participants`)).body;
    const id = (email: string) => ids.find((row) => row.email === email)!.id;
    for (const other of [parker.email, quinn.email]) {
      await api(page, "POST", `/gift_exchanges/${main.id}/exchange_exclusions`, {
        exchange_exclusion: { participant_a_id: id(organizer.email), participant_b_id: id(other) },
      });
    }
    await page.reload();
    await shown(page, "button", /Publish Exchange|Draw names/).click();
    await page.getByRole("dialog").getByRole("button", { name: /Publish Exchange|Draw names/ }).click();
    await expect(page.getByText(/rule/i).filter({ hasText: /remove|change|loosen|too many|no way|can't/i }).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await journey.step("The draw warning matches what Redo can do", page, async () => {
    await page.reload();
    await shown(page, "button", /Publish Exchange|Draw names/).click();
    await expect(page.getByRole("dialog").getByText(/cannot be undone/i)).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  await journey.step("With fair rules the draw works and pending invites close", page, async () => {
    await page.reload();
    const rules = (await api<Array<{ id: number }>>(page, "GET", `/gift_exchanges/${main.id}/exchange_exclusions`)).body;
    for (const rule of rules) await api(page, "DELETE", `/gift_exchanges/${main.id}/exchange_exclusions/${rule.id}`);
    await page.reload();
    await shown(page, "button", /Publish Exchange|Draw names/).click();
    await page.getByRole("dialog").getByRole("button", { name: /Publish Exchange|Draw names/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  }, { required: true });

  await journey.step("Someone who never joined is told it closed, not that they declined", rileySession.page, async () => {
    await rileySession.page.goto(`/join/exchange/${inviteToken(riley.email)}`);
    await expect(rileySession.page.getByText(/previously declined/i)).toHaveCount(0);
    await expect(rileySession.page.getByText(/already (drawn|been drawn)|too late|closed|no longer/i).first()).toBeVisible();
  });

  await journey.step("After the draw, someone can drop out through Redo", page, async () => {
    await page.reload();
    await shown(page, "button", "Redo exchange").click();
    await page.getByTestId("reopen-exchange").click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(shown(page, "button", /^Add$/)).toBeVisible();
  });

  await journey.step("Logged out, the match link brings me back to my match", stranger.page, async () => {
    await shown(page, "button", /Publish Exchange|Draw names/).click();
    await page.getByRole("dialog").getByRole("button", { name: /Publish Exchange|Draw names/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await stranger.page.goto(`/exchanges/${main.slug}/my-match`);
    await expect(stranger.page).toHaveURL(/\/login/, { timeout: 15_000 });
    await signInThroughForm(stranger.page, parker.email);
    await waitUntilSignedIn(stranger.page);
    await expect(stranger.page).toHaveURL(/my-match/, { timeout: 15_000 });
  });

  for (const session of [owner, parkerSession, quinnSession, rileySession, stranger]) await session.context.close();
  journey.finish();
});
