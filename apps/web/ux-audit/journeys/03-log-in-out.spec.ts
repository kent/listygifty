import { expect, test } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { allowClerkTestSession, signInThroughForm, waitUntilSignedIn } from "../support/clerk-ui";
import { Journey, openSession, shown } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const TASK =
  "You're back on a laptop you share with the kids. Sign in, check your home screen, sign out so nobody sees your Christmas plans, make sure pressing Back doesn't show them, then follow a saved link to your exchanges and sign in again.";

test("logging in and out: nothing private is left behind", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("j3-log-in-out", "busy-parent", TASK, testInfo);
  const { page, context } = await openSession(browser, journey);
  const email = E2E_USERS[0].email;
  await allowClerkTestSession(page);

  await journey.step("Find sign in from the front page", page, async () => {
    await page.goto("/");
    await shown(page, "link", /sign in|log in/i).click();
    await expect(page).toHaveURL(/\/login/);
  }, { required: true });

  await journey.step("Sign in with my email", page, async () => {
    await signInThroughForm(page, email);
    await waitUntilSignedIn(page);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  }, { required: true });

  await journey.step("See that I am signed in", page, async () => {
    await expect(shown(page, "button", /sign out/i)).toBeVisible();
  });

  await journey.step("Sign out", page, async () => {
    await shown(page, "button", /sign out/i).click();
    await expect(page).toHaveURL(/localhost:3000\/?$/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  }, { required: true });

  await journey.step("Back button does not show private pages", page, async () => {
    await page.goBack();
    await page.waitForTimeout(2_000);
    await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
    expect(new URL(page.url()).pathname).not.toBe("/dashboard");
  });

  await journey.step("A saved link asks me to sign in", page, async () => {
    await page.goto("/exchanges/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByLabel(/email address/i)).toBeVisible();
  }, { required: true });

  await journey.step("After signing in I land where the link pointed", page, async () => {
    await signInThroughForm(page, email);
    await waitUntilSignedIn(page);
    await expect(page).toHaveURL(/\/exchanges\/new/, { timeout: 15_000 });
  });

  await context.close();
  journey.finish();
});
