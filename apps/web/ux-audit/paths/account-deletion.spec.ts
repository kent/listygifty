import { createClerkClient } from "@clerk/backend";
import { expect, test } from "@playwright/test";
import { api, signedIn } from "../support/api";
import { allowClerkTestSession, signInThroughForm, waitUntilSignedIn } from "../support/clerk-ui";
import { Journey, openSession } from "../support/harness";
import { resetLocalData, rows } from "../support/local";

const EMAIL = "listygifty.e2e+clerk_test_deleteme@example.com";

test("deleting your account removes it from Clerk and the database", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-festive", "One real Clerk deletion is enough.");

  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  expect(secretKey.startsWith("sk_test_"), "only ever run this against the test instance").toBe(true);
  const clerk = createClerkClient({ secretKey });

  resetLocalData();
  const existing = await clerk.users.getUserList({ emailAddress: [EMAIL], limit: 1 });
  for (const user of existing.data) await clerk.users.deleteUser(user.id);
  const clerkUser = await clerk.users.createUser({
    emailAddress: [EMAIL],
    firstName: "Delete",
    lastName: "Me",
    skipPasswordRequirement: true,
  });

  const journey = new Journey("r3-account-deletion", "new-relative", "Delete my account for real.", testInfo);
  const { page, context } = await openSession(browser, journey);
  await allowClerkTestSession(page);

  await journey.step("Sign in as a real test account", page, async () => {
    await page.goto("/login");
    await signInThroughForm(page, EMAIL);
    await waitUntilSignedIn(page);
    await signedIn(page);
    expect(rows(`SELECT id FROM users WHERE email = '${EMAIL}'`)).toHaveLength(1);
  }, { required: true });

  await journey.step("A delete with no confirmation is refused", page, async () => {
    expect((await api(page, "DELETE", "/profile")).status).toBe(422);
    expect(rows(`SELECT id FROM users WHERE email = '${EMAIL}'`)).toHaveLength(1);
  });

  await journey.step("The account is gone from Clerk and the database", page, async () => {
    expect((await api(page, "DELETE", "/profile?confirmation=DELETE")).status).toBe(204);
    expect(rows(`SELECT id FROM users WHERE email = '${EMAIL}'`)).toHaveLength(0);
    await expect(clerk.users.getUser(clerkUser.id)).rejects.toMatchObject({ status: 404 });
  });

  await context.close();
  journey.finish();
});
