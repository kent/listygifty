import { expect, test } from "@playwright/test";
import { Journey, action, goToNav, openSession, shown } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const TASK =
  "It's the end of October and you have kids to buy for. Start a Christmas list, add a gift for your daughter Maya and one for your dad, mark Maya's as bought, fix a typo in a gift name, remove the one you changed your mind on, then find your list again.";

test("gift lists: a busy parent keeps track of Christmas", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("j1-gift-lists", "busy-parent", TASK, testInfo);
  const { page, context } = await openSession(browser, journey, { role: "owner" });
  const phone = Boolean(testInfo.project.use.isMobile);

  const addGift = async (name: string, person: string, cost?: string) => {
    const opener = phone ? shown(page, "button", "Add gift") : shown(page, "button", /^Add Gift$/);
    await opener.click();
    await page.getByLabel("Gift name").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("combobox", { name: /Who is it for/ }).click();
    await page.getByPlaceholder("Search or create...").fill(person);
    await page.getByRole("option", { name: `Create "${person}"` }).click();
    await expect(page.getByRole("combobox", { name: /Who is it for/ })).toContainText(person);
    await page.keyboard.press("Escape");
    if (cost) {
      await page.getByRole("button", { name: /Advanced/ }).click();
      await page.getByLabel("Cost").fill(cost);
    }
    await page.getByRole("button", { name: "Add Gift", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  };

  const giftRow = (name: string) =>
    phone
      ? page.locator('[data-slot="card"]').filter({ hasText: name }).first()
      : page.locator("tr").filter({ hasText: name }).first();

  await journey.step("Open my home screen", page, async () => {
    await page.goto("/dashboard");
    await expect(action(page, /New Gift List/)).toBeVisible();
  }, { required: true });

  await journey.step("Start a Christmas list", page, async () => {
    await action(page, /New Gift List/).click();
    await expect(page).toHaveURL(/section=new/);
    await shown(page, "button", /Christmas/).click();
    await expect(page.getByText(/Created "Christmas"|Christmas/).first()).toBeVisible();
  }, { required: true });

  await journey.step("Open the new list", page, async () => {
    if (!/\/holidays\/\d+/.test(page.url())) await action(page, /Christmas/).click();
    await expect(page).toHaveURL(/\/holidays\/\d+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Christmas/ }).first()).toBeVisible();
  }, { required: true });

  await journey.step("Add a gift for Maya", page, () => addGift("LEGO Botanicals", "Maya"));

  await journey.step("Add a gift for Dad with a price", page, () => addGift("Golf balls", "Dad", "40"));

  await journey.step("Both gifts show who they are for", page, async () => {
    await expect(giftRow("LEGO Botanicals")).toContainText("Maya");
    await expect(giftRow("Golf balls")).toContainText("Dad");
  });

  await journey.step("Mark Maya's gift as bought", page, async () => {
    if (phone) await giftRow("LEGO Botanicals").getByRole("button").first().click();
    await giftRow("LEGO Botanicals").getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Purchased" }).click();
    await expect(giftRow("LEGO Botanicals")).toContainText("Purchased");
    await page.waitForTimeout(400);
    await page.reload();
    await expect(giftRow("LEGO Botanicals")).toContainText("Purchased");
  });

  await journey.step("Fix a typo in the gift name", page, async () => {
    if (phone) await giftRow("Golf balls").getByRole("button").first().click();
    await giftRow("Golf balls").getByText("Golf balls", { exact: true }).last().click();
    await page.locator('input[placeholder="Gift name..."]').fill("Golf balls (Pro V1)");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.reload();
    await expect(giftRow("Golf balls (Pro V1)")).toBeVisible();
  });

  await journey.step("Remove a gift I changed my mind on", page, async () => {
    const row = giftRow("Golf balls (Pro V1)");
    if (phone) {
      await row.getByRole("button").first().click();
      await row.getByRole("button", { name: "Delete" }).click();
    } else {
      await row.hover();
      await row.getByRole("button").last().click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
    }
    await page.getByRole("button", { name: "Delete Gift" }).click();
    await expect(page.getByText("Gift deleted").first()).toBeVisible();
  });

  await journey.step("Find my list again from Gift Lists", page, async () => {
    await goToNav(page, "Gift Lists");
    await expect(page).toHaveURL(/\/holidays(\?|$)/);
    await expect(page.getByText(/Christmas/).first()).toBeVisible();
  });

  await context.close();
  journey.finish();
});
