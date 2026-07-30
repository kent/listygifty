import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { authStatePath, E2E_USERS } from "./support/test-users";

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing", async () => {
  await clerkSetup();
});

setup("prepare five authenticated Clerk users", async ({ browser, baseURL }) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required for Clerk E2E authentication.");
  }

  const clerkClient = createClerkClient({ secretKey });
  await fs.mkdir(path.dirname(authStatePath("owner")), { recursive: true });

  for (const user of E2E_USERS) {
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [user.email],
      limit: 1,
    });

    if (existingUsers.data.length === 0) {
      await clerkClient.users.createUser({
        emailAddress: [user.email],
        firstName: user.firstName,
        lastName: user.lastName,
        skipPasswordRequirement: true,
      });
    }

    const context = await browser.newContext({
      baseURL: baseURL || "http://localhost:3000",
    });
    const page = await context.newPage();
    await page.goto(baseURL || "http://localhost:3000");
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto("/exchanges");
    await expect(page).toHaveURL(/\/exchanges$/);
    await context.storageState({ path: authStatePath(user.role) });
    await context.close();
  }
});
