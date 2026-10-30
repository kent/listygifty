import { expect, test } from "@playwright/test";
import { Journey, action, goToNav, openSession, shown } from "../support/harness";
import { clearMail, firstLink, resetLocalData, waitForMail } from "../support/local";

const TASK =
  "Your birthday's coming and the family keeps asking what you want. Make a wishlist, add two things with a link and a price, and share it. Your cousin has no account and just wants to reserve one so nobody doubles up.";

const GUEST_EMAIL = "cousin.guest@example.com";

test("wishlist: make one, share it, a guest reserves a gift", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("j5-wishlist", "busy-parent", TASK, testInfo);
  const { page, context } = await openSession(browser, journey, { role: "owner" });

  const addItem = async (opener: () => Promise<void>, name: string, price: string) => {
    await opener();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Item name").fill(name);
    await dialog.getByPlaceholder("https://...").fill("https://example.com/item");
    await dialog.getByRole("spinbutton").first().fill(price);
    await dialog.getByRole("button", { name: "Add Item" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(name).first()).toBeVisible();
  };

  await journey.step("Find wishlists from my home screen", page, async () => {
    await page.goto("/dashboard");
    await goToNav(page, /(^|\s)Wishlists$/);
    await expect(page).toHaveURL(/\/wishlists/);
  });

  await journey.step("Open wishlists", page, async () => {
    // A person who could not find it above would have to be told the address.
    if (!/\/wishlists/.test(page.url())) await page.goto("/wishlists");
    await expect(page.getByRole("heading", { name: "Wishlists" }).first()).toBeVisible();
  }, { required: true });

  await journey.step("Create a birthday wishlist to share", page, async () => {
    await action(page, /Create Your First Wishlist/).click();
    await expect(page).toHaveURL(/\/wishlists\/new/);
    await page.getByPlaceholder(/Birthday Wishlist/).fill("My birthday");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Shared Link/ }).click();
    await page.getByRole("button", { name: "Create Wishlist" }).click();
    await expect(page).toHaveURL(/\/wishlists\/\d+/, { timeout: 15_000 });
  }, { required: true });

  await journey.step("Add the first thing I want", page, () =>
    addItem(() => shown(page, "button", /Add Your First Item/).click(), "Pasta machine", "80")
  );

  await journey.step("Add a second thing", page, () =>
    addItem(() => shown(page, "button", /^Add Item$/).click(), "Rain jacket", "120")
  );

  let shareUrl = "";
  await journey.step("Get a link to share", page, async () => {
    await shown(page, "button", /^Share$/).click();
    const field = page.getByRole("dialog").getByRole("textbox").first();
    await expect(field).toHaveValue(/\/w\//);
    shareUrl = await field.inputValue();
  }, { required: true });

  await journey.step("Copy the link", page, async () => {
    await page.getByRole("dialog").getByRole("button", { name: /copy/i }).click({ timeout: 4_000 });
    await expect(page.getByText(/copied/i).first()).toBeVisible();
  });

  await journey.step("Close the share window", page, async () => {
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  const guest = await openSession(browser, journey, { phone: true });

  await journey.step("My cousin opens the link with no account", guest.page, async () => {
    await guest.page.goto(shareUrl);
    await expect(guest.page.getByText("My birthday").first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.page.getByText("Pasta machine").first()).toBeVisible();
  });

  await journey.step("My cousin reserves one thing", guest.page, async () => {
    const reserve = guest.page.getByRole("button", { name: /reserve/i }).first();
    await reserve.click();
    const dialog = guest.page.getByRole("dialog");
    await dialog.getByPlaceholder("Enter your name").fill("Cousin Sam");
    await dialog.getByPlaceholder("your@email.com").fill(GUEST_EMAIL);
    await dialog.getByRole("button", { name: "Claim Item" }).click();
    await expect(dialog).toHaveCount(0);
  });

  let manageUrl = "";
  await journey.step("My cousin gets a confirmation email", null, async () => {
    const mail = await waitForMail(GUEST_EMAIL, /You've reserved/);
    manageUrl = firstLink(mail, /http:\/\/localhost:3000\/claim\/\S+/);
  });

  await journey.step("The email link works with no account", guest.page, async () => {
    expect(manageUrl).not.toBe("");
    await guest.page.goto(manageUrl);
    await expect(guest.page.getByText("Pasta machine").first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.page).not.toHaveURL(/\/login/);
  });

  await journey.step("I can still see my list and it isn't spoiled", page, async () => {
    await page.reload();
    await expect(page.getByText("Pasta machine").first()).toBeVisible();
    await expect(page.getByText("Cousin Sam")).toHaveCount(0);
  });

  await guest.context.close();
  await context.close();
  journey.finish();
});
