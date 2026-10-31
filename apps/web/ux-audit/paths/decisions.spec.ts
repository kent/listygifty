import { expect, test } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { acceptInvite, api, inviteToken, seedExchange, signedIn } from "../support/api";
import { allowClerkTestSession } from "../support/clerk-ui";
import { Journey, action, openSession, shown } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const [, parker, quinn, riley] = E2E_USERS;
const asInvitee = (user: (typeof E2E_USERS)[number]) => ({ name: user.firstName, email: user.email });
const NANA = { name: "Nana Fenn", email: "listygifty.e2e+clerk_test_nanadecisions@example.com" };

test("the decisions Kent picked work in a real browser", async ({ browser }, testInfo) => {
  test.setTimeout(420_000);
  resetLocalData();
  await clearMail();
  const journey = new Journey("r2-decisions", "busy-parent", "Prove each picked decision in a real browser.", testInfo);
  const owner = await openSession(browser, journey, { role: "owner" });
  const phone = await openSession(browser, journey, { role: "owner", phone: true });
  const parkerSession = await openSession(browser, journey, { role: "participant-1" });
  const quinnSession = await openSession(browser, journey, { role: "participant-2" });
  const rileySession = await openSession(browser, journey, { role: "participant-3" });
  const stranger = await openSession(browser, journey, { phone: true });
  await allowClerkTestSession(stranger.page);
  const page = owner.page;
  for (const session of [page, parkerSession.page, quinnSession.page, rileySession.page]) await signedIn(session);

  let listPath = "";
  await journey.step("Purchased moves Progress, and the next gift says who it's for", page, async () => {
    await page.goto("/dashboard");
    await action(page, /New Gift List/).click();
    await shown(page, "button", /Christmas/).click();
    await expect(page).toHaveURL(/\/holidays\/\d+/, { timeout: 15_000 });
    listPath = new URL(page.url()).pathname;

    await shown(page, "button", /^Add Gift$/).click();
    await page.getByLabel("Gift name").fill("LEGO Botanicals");
    await page.getByRole("dialog").getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("combobox", { name: /Who is it for/ }).click();
    await page.getByPlaceholder("Search or create...").fill("Maya");
    await page.getByRole("option", { name: 'Create "Maya"' }).click();
    await expect(page.getByRole("combobox", { name: /Who is it for/ })).toContainText("Maya");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save & Add Another" }).click();
    await expect(page.getByText("This next gift is still for Maya. You can change that on the next step.")).toBeVisible();
    await page.getByLabel("Gift name").fill("Golf balls");
    await page.getByRole("dialog").getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("button", { name: "Add Gift", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const row = page.locator("tr").filter({ hasText: "LEGO Botanicals" }).first();
    await row.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Purchased" }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText("1/2").first()).toBeVisible();
    await expect(page.getByText("50% complete").first()).toBeVisible();
  });

  await journey.step("Phones get the summary in two columns", phone.page, async () => {
    await phone.page.goto(listPath);
    await expect(phone.page.getByText("Planned Spend").first()).toBeVisible({ timeout: 15_000 });
    const columns = await phone.page.getByText("Planned Spend").first().evaluate((node) => {
      let element = node as HTMLElement | null;
      while (element && getComputedStyle(element).display !== "grid") element = element.parentElement;
      return element ? getComputedStyle(element).gridTemplateColumns.split(" ").length : 0;
    });
    expect(columns).toBe(2);
  });

  const created = await api<{ id: number }>(page, "POST", "/wishlists", { wishlist: { name: "My birthday", visibility: "private" } });
  await api(page, "POST", `/wishlists/${created.body.id}/wishlist_items`, { wishlist_item: { name: "Pasta machine" } });

  await journey.step("Share says the list is now shared, and the link can be turned off", page, async () => {
    await page.goto(`/wishlists/${created.body.id}`);
    await expect(page.getByText("Pasta machine").first()).toBeVisible();
    await page.getByRole("button", { name: /^Share$/ }).or(page.locator("button:has(svg.lucide-share-2)")).locator("visible=true").first().click();
    await expect(page.getByText("This list was private. It is now shared.")).toBeVisible();
    const url = await page.getByRole("textbox", { name: "Share link" }).inputValue();
    await page.getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const token = new URL(url).pathname.split("/").pop();
    expect((await fetch(`http://localhost:3001/w/${token}`)).status).toBe(404);
  });

  await journey.step("Settings starts with the person, and MCP lives in Integrations", page, async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" }).first()).toBeVisible();
    await expect(page.getByText("Your MCP OAuth URL")).toHaveCount(0);
    await shown(page, "button", /Integrations/).click();
    await expect(page.getByText("Your MCP OAuth URL").first()).toBeVisible();
  });

  await journey.step("A personal workspace doesn't offer business categories", page, async () => {
    await page.goto("/people");
    await expect(page.getByRole("button", { name: "Family", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Vendors", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Investors", exact: true })).toHaveCount(0);
  });

  const exchange = await seedExchange(page, "Family Christmas", [asInvitee(parker), asInvitee(quinn), asInvitee(riley), NANA]);
  await acceptInvite(parkerSession.page, parker.email);
  await acceptInvite(quinnSession.page, quinn.email);
  await acceptInvite(rileySession.page, riley.email);

  await journey.step("Sign-up fills in what the invite already knows", stranger.page, async () => {
    await stranger.page.goto(`/join/exchange/${inviteToken(NANA.email)}`);
    await expect(stranger.page.getByRole("heading", { name: "Family Christmas" })).toBeVisible({ timeout: 15_000 });
    await stranger.page.getByRole("link", { name: "Sign Up" }).click();
    await expect(stranger.page.locator('input[name="emailAddress"]')).toHaveValue(NANA.email, { timeout: 20_000 });
    await expect(stranger.page.locator('input[name="firstName"]')).toHaveValue("Nana");
    await expect(stranger.page.locator('input[name="lastName"]')).toHaveValue("Fenn");
  });

  await journey.step("Home shows the exchange before the draw, with the next step", page, async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your Exchange" })).toBeVisible();
    await expect(page.getByText("4 of 5 joined. Draw names when you're ready.")).toBeVisible();
    await expect(page.getByText("Gift exchange").first()).toBeVisible();
  });

  await journey.step("The draw says Draw names from start to finish", page, async () => {
    await page.goto(`/exchanges/${exchange.slug}`);
    await shown(page, "button", "Draw names").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Draw names?" })).toBeVisible();
    await expect(dialog.getByText("Ready to draw:")).toBeVisible();
    await expect(page.getByText(/publish/i)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Draw names" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  }, { required: true });

  await journey.step("After the draw, Home goes straight to the match", page, async () => {
    await page.goto("/dashboard");
    await page.getByText("Names are drawn. See who you're buying for.").click();
    await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.slug}/my-match`));
  });

  await journey.step("Function keys show on desktop but not on a phone", null, async () => {
    for (const [touch, expected] of [[false, 1], [true, 0]] as const) {
      const context = await browser.newContext({
        baseURL: "http://localhost:3000",
        viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        isMobile: touch,
        hasTouch: touch,
      });
      await context.addInitScript(() => window.localStorage.setItem("listygifty-theme", "festive"));
      const visitor = await context.newPage();
      await visitor.goto("/");
      await expect(visitor.getByRole("link", { name: /Sign in/ }).first()).toBeVisible();
      await expect(visitor.locator(".retro-key-hint:visible")).toHaveCount(expected ? 3 : 0);
      await context.close();
    }
  });

  await journey.step("A stranger gets the theme for the time of year, and a choice sticks", null, async () => {
    for (const [time, theme] of [["2026-07-15T12:00:00", "apple"], ["2026-11-02T12:00:00", "festive"], ["2027-01-02T12:00:00", "apple"]] as const) {
      const context = await browser.newContext({ baseURL: "http://localhost:3000" });
      const visitor = await context.newPage();
      await visitor.clock.install({ time: new Date(time) });
      await visitor.goto("/login");
      await expect.poll(() => visitor.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe(theme);
      await context.close();
    }
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addInitScript(() => window.localStorage.setItem("listygifty-theme", "festive"));
    const visitor = await context.newPage();
    await visitor.clock.install({ time: new Date("2026-07-15T12:00:00") });
    await visitor.goto("/login");
    await expect.poll(() => visitor.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("festive");
    await context.close();
  });

  for (const session of [owner, phone, parkerSession, quinnSession, rileySession, stranger]) await session.context.close();
  journey.finish();
});
