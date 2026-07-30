import { expect, test, type Browser, type Page } from "@playwright/test";
import { authStatePath, E2E_USERS, type E2EUser } from "./support/test-users";

const invitees = E2E_USERS.slice(1);

async function addInvitee(page: Page, invitee: E2EUser): Promise<string> {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByPlaceholder("John Doe").fill(`${invitee.firstName} ${invitee.lastName}`);
  await page.getByPlaceholder("john@example.com").fill(invitee.email);
  await page.getByRole("button", { name: "Add & Invite" }).click();

  const row = page
    .locator('[class*="rounded-lg"]')
    .filter({ hasText: `${invitee.firstName} ${invitee.lastName}` })
    .filter({ hasText: invitee.email });
  await expect(row).toContainText("Needs to join");
  await row
    .getByRole("button", { name: `Copy invite for ${invitee.firstName} ${invitee.lastName}` })
    .click();

  const inviteUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/join\/exchange\//);
  return inviteUrl;
}

async function joinExchange(
  browser: Browser,
  invitee: E2EUser,
  inviteUrl: string,
  exchangeName: string,
  expectedJoinedCount: number
) {
  const context = await browser.newContext({
    storageState: authStatePath(invitee.role),
  });
  const page = await context.newPage();

  await page.goto(inviteUrl);
  await expect(page.getByText("You Are Invited!", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: exchangeName })).toBeVisible();
  await page.getByRole("button", { name: "Join Exchange" }).click();
  await expect(page).toHaveURL(/\/exchanges\/.+/);
  await expect(page.getByRole("heading", { name: exchangeName })).toBeVisible();
  await expect(page.getByText("Joined", { exact: true })).toHaveCount(expectedJoinedCount);

  await context.close();
}

test("five users create, join, and inspect a local gift exchange", async ({ page, browser }) => {
  const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const exchangeName = `Local E2E Gift Exchange ${runId}`;

  await page.goto("/exchanges/new");
  await page.getByLabel("Exchange Name *").fill(exchangeName);
  await page.getByRole("button", { name: "Create Exchange" }).click();

  await expect(page).toHaveURL(/\/exchanges\/local-e2e-gift-exchange-/);
  await expect(page.getByRole("heading", { name: exchangeName })).toBeVisible();
  await expect(page.getByText("1/1 joined")).toBeVisible();

  const inviteUrls: string[] = [];
  for (const invitee of invitees) {
    inviteUrls.push(await addInvitee(page, invitee));
  }

  await expect(page.getByText("1/5 joined")).toBeVisible();
  await expect(page.getByText("Needs to join", { exact: true })).toHaveCount(4);

  for (const [index, invitee] of invitees.entries()) {
    await joinExchange(browser, invitee, inviteUrls[index], exchangeName, index + 2);
  }

  await page.reload();
  await expect(page.getByText("5/5 joined")).toBeVisible();
  await expect(page.getByText("Joined", { exact: true })).toHaveCount(5);

  const participantContext = await browser.newContext({
    storageState: authStatePath(invitees[0].role),
  });
  const participantPage = await participantContext.newPage();
  await participantPage.goto(page.url());
  await expect(participantPage.getByText("5/5 joined")).toBeVisible();
  const participantRoster = participantPage.getByTestId("participant-roster");

  for (const user of E2E_USERS) {
    await expect(
      participantRoster.getByText(user.firstName, { exact: true })
    ).toBeVisible();
    await expect(participantRoster.getByText(user.email, { exact: true })).toHaveCount(0);
  }

  await participantContext.close();
});
