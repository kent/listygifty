import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Clerk's test mode: +clerk_test addresses never get mail and accept this code.
const TEST_CODE = "424242";
const HANG_LOG = path.resolve(__dirname, "../../../../docs/ux-audit/runs/clerk-hangs.log");

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
  // A person takes a moment per digit. Clerk submits on the sixth.
  await code.pressSequentially(TEST_CODE, { delay: 150 });
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

/**
 * Clerk's own form occasionally hangs on a spinner after a code is submitted. A
 * person would reload and type the code again, so do that, and log it so the
 * hang is never hidden.
 */
export async function waitUntilSignedIn(page: Page) {
  const signedIn = () =>
    page.evaluate(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user));

  try {
    await expect.poll(signedIn, { timeout: 10_000 }).toBe(true);
    return;
  } catch {
    fs.appendFileSync(HANG_LOG, `${new Date().toISOString()} hung at ${page.url()}\n`);
  }

  // After a reload Clerk shows a fresh code box, so a person types it again.
  await page.reload();
  await enterCode(page);
  await expect.poll(signedIn, { timeout: 15_000 }).toBe(true);
  fs.appendFileSync(HANG_LOG, `${new Date().toISOString()} recovered by retyping the code at ${page.url()}\n`);
}
