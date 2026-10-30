import { expect, test } from "@playwright/test";
import { Journey, goToNav, navItem, openSession, shown } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const TASK =
  "You're new here. Without anyone showing you around, find your gift lists, your exchanges, your people, your wishlists and your settings. Then get back home, and recover when a link is broken.";

const DESTINATIONS: Array<[string, string, RegExp, RegExp]> = [
  ["Gift Lists", "Gift Lists", /\/holidays/, /Gift Lists/],
  ["Exchanges", "Exchanges", /\/exchanges/, /Gift Exchanges/],
  ["People", "People", /\/people/, /People/],
  ["Wishlists", "Wishlists", /\/wishlists/, /Wishlists/],
];

test("navigating: every part of the site can be found from the menu", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("j4-navigation", "new-relative", TASK, testInfo);
  const { page, context } = await openSession(browser, journey, { role: "owner" });

  await journey.step("Open my home screen", page, async () => {
    await page.goto("/dashboard");
    await expect(shown(page, "link", navItem("Home"))).toBeVisible();
  }, { required: true });

  for (const [stepName, navLabel, url, heading] of DESTINATIONS) {
    await journey.step(`Find ${stepName} in the menu`, page, async () => {
      await goToNav(page, navItem(navLabel));
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });

    await journey.step(`${stepName} is marked as the current page`, page, async () => {
      const current = page.locator('nav [aria-current="page"]').locator("visible=true").first();
      await expect(current).toContainText(navLabel);
    });
  }

  await journey.step("Find my settings", page, async () => {
    await goToNav(page, navItem("(Settings|Options)"));
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /Settings|Options/ }).first()).toBeVisible();
  });

  await journey.step("The logo takes me home", page, async () => {
    await shown(page, "link", /Listy Gifty home/).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await journey.step("A broken link explains itself and offers a way back", page, async () => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/not found|can't find|cannot find/i).first()).toBeVisible();
    await expect(shown(page, "link", /home|dashboard/i)).toBeVisible();
  });

  await journey.step("The menu never pushes the page sideways", page, async () => {
    await page.goto("/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  await context.close();
  journey.finish();
});
