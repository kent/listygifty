import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
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

async function openAs(browser: Browser, user: E2EUser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: authStatePath(user.role) });
  return { context, page: await context.newPage() };
}

async function addExclusion(page: Page, first: E2EUser, second: E2EUser) {
  await page.getByRole("button", { name: "Add Rule" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: first.firstName, exact: true }).click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: second.firstName, exact: true }).click();
  await dialog.getByRole("button", { name: "Add Rule" }).click();
  await expect(page.getByText("Exclusion rule added")).toBeVisible();
}

async function addWishlistItem(page: Page, exchangeUrl: string, itemName: string) {
  await page.goto(`${exchangeUrl}/my-wishlist`);
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  await page.getByPlaceholder("What would you like?").fill(itemName);
  await page.getByPlaceholder("Size, color, or other details...").fill("Local five-user E2E idea");
  await page.getByRole("button", { name: "Add Item", exact: true }).last().click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();
}

async function mailpitMessages(request: APIRequestContext) {
  const response = await request.get("http://localhost:8025/api/v1/messages");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    total: number;
    messages: Array<{ ID: string; Subject: string }>;
  };
}

test("five users complete a private exchange lifecycle with real local mail", async ({
  page,
  browser,
  request,
}) => {
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

  await expect
    .poll(async () => (await mailpitMessages(request)).messages.filter((message) =>
      message.Subject.includes("wants you in")
    ).length)
    .toBe(4);

  await addExclusion(page, E2E_USERS[0], E2E_USERS[1]);
  await addExclusion(page, E2E_USERS[2], E2E_USERS[3]);

  await page.getByRole("button", { name: "Publish Exchange" }).click();
  const publishDialog = page.getByRole("dialog");
  await expect(publishDialog.getByText("2 exclusion rules")).toBeVisible();
  await publishDialog.getByRole("button", { name: "Publish Exchange" }).click();
  await expect(page.getByText("active", { exact: true })).toBeVisible();

  await expect
    .poll(async () => (await mailpitMessages(request)).messages.filter((message) =>
      message.Subject.includes("The names are in")
    ).length)
    .toBe(5);

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

  const matchByRole = new Map<E2EUser["role"], string>();
  for (const user of E2E_USERS) {
    const session = await openAs(browser, user);
    await session.page.goto(`${page.url()}/my-match`);
    const reveal = session.page.locator("h1").filter({ hasText: "🎁" });
    await expect(reveal).toBeVisible();
    const revealedName = (await reveal.textContent())?.replace("🎁", "").trim();
    expect(revealedName).toBeTruthy();
    expect(revealedName).not.toBe(user.firstName);
    matchByRole.set(user.role, revealedName!);
    await session.context.close();
  }

  const giver = invitees[0];
  const recipientName = matchByRole.get(giver.role)!;
  const recipient = E2E_USERS.find((user) => user.firstName === recipientName)!;
  const unrelated = E2E_USERS.find(
    (user) => user.role !== giver.role && user.role !== recipient.role
  )!;
  const itemName = `E2E wishlist idea ${runId}`;

  const recipientSession = await openAs(browser, recipient);
  await addWishlistItem(recipientSession.page, page.url(), itemName);
  await recipientSession.context.close();

  const giverSession = await openAs(browser, giver);
  await giverSession.page.goto(page.url());
  await expect(
    giverSession.page.getByText("Your match added a new wishlist item.", { exact: true })
  ).toBeVisible();
  await giverSession.page.goto(`${page.url()}/my-match`);
  await expect(giverSession.page.getByText(itemName, { exact: true })).toBeVisible();
  await giverSession.page.getByRole("button", { name: /Ask .* for more wishlist ideas anonymously/ }).click();
  await expect(giverSession.page.getByText("Anonymous request sent")).toBeVisible();
  await giverSession.page.getByRole("button", { name: /Ask .* for more wishlist ideas anonymously/ }).click();
  await expect(giverSession.page.getByText(/already sent in the last 24 hours/)).toBeVisible();
  await giverSession.context.close();

  const recipientNotificationSession = await openAs(browser, recipient);
  await recipientNotificationSession.page.goto(page.url());
  await expect(
    recipientNotificationSession.page.getByText(
      "Your Secret Santa would love a few more wishlist ideas.",
      { exact: true }
    )
  ).toBeVisible();
  await recipientNotificationSession.context.close();

  const unrelatedSession = await openAs(browser, unrelated);
  await unrelatedSession.page.goto(page.url());
  await expect(
    unrelatedSession.page.getByText("Your Secret Santa would love a few more wishlist ideas.", {
      exact: true,
    })
  ).toHaveCount(0);
  await unrelatedSession.context.close();

  await expect
    .poll(async () => {
      const messages = await mailpitMessages(request);
      return {
        reveal: messages.messages.filter((message) =>
          message.Subject.includes("The names are in")
        ).length,
        update: messages.messages.filter((message) =>
          message.Subject.includes("Good news: your match added an idea")
        ).length,
        nudge: messages.messages.filter((message) =>
          message.Subject.includes("Your Secret Santa needs a little help")
        ).length,
      };
    })
    .toEqual({ reveal: 5, update: 1, nudge: 1 });
});
