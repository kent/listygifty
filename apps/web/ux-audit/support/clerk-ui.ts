import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";

// Clerk's test mode: +clerk_test addresses never get mail and accept this code.
const TEST_CODE = "424242";

/**
 * Must run before the first navigation: Clerk reads the bypass when it loads,
 * and without it a new account stops at the human check.
 */
export async function allowClerkTestSession(page: Page) {
  await setupClerkTestingToken({ page });
}

async function enterCode(page: Page) {
  const code = page.getByRole("textbox", { name: /code/i }).first();
  await code.waitFor({ timeout: 15_000 });
  await code.pressSequentially(TEST_CODE, { delay: 40 });
}

/** The sign-in form as a person uses it, not Clerk's programmatic shortcut. */
export async function signInThroughForm(page: Page, email: string) {
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /^continue/i }).click();
  await enterCode(page);
}

export async function signUpThroughForm(
  page: Page,
  person: { firstName: string; lastName: string; email: string; password: string }
) {
  await page.getByLabel(/first name/i).fill(person.firstName);
  await page.getByLabel(/last name/i).fill(person.lastName);
  await page.getByLabel(/email address/i).fill(person.email);
  await page.getByLabel(/^password/i).fill(person.password);
  await page.getByRole("button", { name: /^continue/i }).click();
  await enterCode(page);
}

export async function waitUntilSignedIn(page: Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user)), {
      timeout: 20_000,
    })
    .toBe(true);
}
