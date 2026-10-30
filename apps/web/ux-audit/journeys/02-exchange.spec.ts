import { createClerkClient } from "@clerk/backend";
import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { allowClerkTestSession, signUpThroughForm, waitUntilSignedIn } from "../support/clerk-ui";
import { Journey, action, goToNav, openSession, shown } from "../support/harness";
import { allMail, clearMail, failedJobs, firstLink, mailBody, resetLocalData, rows, waitForMail } from "../support/local";

const TASK =
  "You run the family gift exchange. Set one up for Christmas, invite four relatives by email, including Nana who has never heard of this site and is on a phone. Get everyone in, keep the couple from drawing each other, and make sure everyone privately finds out who they're buying for.";

const EXCHANGE_NAME = "Family Christmas";
const organizer = E2E_USERS[0];
const relatives = E2E_USERS.slice(1, 4);

type Match = { id: number; name: string; email: string; matched_participant_id: number | null };

function findMatchKeys(value: unknown, trail: string, found: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findMatchKeys(item, `${trail}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/^matched_(participant|participant_id)$/.test(key) && child !== null) found.push(`${trail}.${key}`);
      findMatchKeys(child, `${trail}.${key}`, found);
    }
  }
}

test("exchange: invite everyone by email and get them all assigned", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("j2-exchange", "new-relative", TASK, testInfo);
  const runId = Date.now().toString(36);
  const nana = {
    firstName: "Nana",
    lastName: "Test",
    email: `listygifty.e2e+clerk_test_nana${runId}@example.com`,
    password: `Ux-Audit-${runId}-Gifts!`,
  };

  const owner = await openSession(browser, journey, { role: "owner" });
  const page = owner.page;

  // Every JSON body each person's browser received, for the secrecy check.
  const received = new Map<string, Array<{ url: string; body: unknown }>>();
  const record = (who: string, target: Page) => {
    received.set(who, received.get(who) ?? []);
    target.on("response", async (response) => {
      if (!response.url().startsWith("http://localhost:3001")) return;
      const body = await response.json().catch(() => null);
      if (body) received.get(who)!.push({ url: new URL(response.url()).pathname, body });
    });
  };
  record(organizer.firstName, page);

  await journey.step("Find exchanges in the menu", page, async () => {
    await page.goto("/dashboard");
    await goToNav(page, /(^|\s)Exchanges$/);
    await expect(page.getByRole("heading", { name: "Gift Exchanges" })).toBeVisible();
  }, { required: true });

  await journey.step("Start a new exchange", page, async () => {
    await action(page, /Create Your First Exchange|New Exchange/).click();
    await expect(page).toHaveURL(/\/exchanges\/new/);
  }, { required: true });

  await journey.step("Fill in the details", page, async () => {
    await page.getByLabel("Exchange Name *").fill(EXCHANGE_NAME);
    await page.getByLabel("Exchange Date", { exact: true }).fill(`${new Date().getFullYear()}-12-25`);
    await page.getByLabel(/Maximum Budget/).fill("50");
  });

  await journey.step("Create the exchange", page, async () => {
    await page.getByRole("button", { name: "Create Exchange" }).click();
    await expect(page).toHaveURL(/\/exchanges\/family-christmas/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: EXCHANGE_NAME })).toBeVisible();
  }, { required: true });

  const invite = async (person: { firstName: string; lastName: string; email: string }) => {
    await shown(page, "button", /^Add$/).click();
    await page.getByLabel("Name").fill(`${person.firstName} ${person.lastName}`);
    await page.getByLabel("Email").fill(person.email);
    await page.getByRole("button", { name: "Add & Invite" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("participant-roster")).toContainText(person.firstName);
  };

  for (const relative of relatives) {
    await journey.step(`Invite ${relative.firstName} by email`, page, () => invite(relative), { required: true });
  }
  await journey.step("Invite Nana by email", page, () => invite(nana), { required: true });

  await journey.step("The page shows the invites went out", page, async () => {
    await expect(page.getByText("draft", { exact: true })).toHaveCount(0);
  });

  await journey.step("The organizer knows what happens next", page, async () => {
    await expect(page.getByText(/(once|when|until|waiting|need).{0,40}(join|people|person)/i).first()).toBeVisible();
  });

  await journey.step("The organizer can add their own wishes", page, async () => {
    await expect(action(page, /Wishlist/)).toBeVisible();
  });

  const sessions = new Map<string, Page>();

  for (const relative of relatives) {
    const session = await openSession(browser, journey, { role: relative.role });
    sessions.set(relative.firstName, session.page);
    record(relative.firstName, session.page);

    await journey.step(`${relative.firstName} joins from the invite email`, session.page, async () => {
      const mail = await waitForMail(relative.email, /wants you in/);
      await session.page.goto(firstLink(mail, /http:\/\/localhost:3000\/join\/exchange\/\S+/));
      await expect(session.page.getByRole("heading", { name: EXCHANGE_NAME })).toBeVisible();
      await session.page.getByRole("button", { name: "Join Exchange" }).click();
      await expect(session.page).toHaveURL(/\/exchanges\/family-christmas/);
    });

    // A person who hits an error tries again; the failure above stays on record.
    if (!/\/exchanges\/family-christmas/.test(session.page.url())) {
      await session.page.reload();
      await session.page.getByRole("button", { name: "Join Exchange" }).click().catch(() => {});
      await session.page.waitForURL(/\/exchanges\/family-christmas/, { timeout: 10_000 }).catch(() => {});
    }
  }

  const first = relatives[0];
  const firstPage = () => sessions.get(first.firstName)!;

  await journey.step(`${first.firstName} can add wishes right after joining`, firstPage(), async () => {
    await action(firstPage(), /Wishlist/).click();
    await expect(firstPage()).toHaveURL(/my-wishlist/);
  });

  const nanaSession = await openSession(browser, journey, { phone: true });
  const nanaPage = nanaSession.page;
  await allowClerkTestSession(nanaPage);
  sessions.set(nana.firstName, nanaPage);
  record(nana.firstName, nanaPage);
  let nanaInvite = "";

  await journey.step("Nana opens the email on a phone", nanaPage, async () => {
    const mail = await waitForMail(nana.email, /wants you in/);
    nanaInvite = firstLink(mail, /http:\/\/localhost:3000\/join\/exchange\/\S+/);
    await nanaPage.goto(nanaInvite);
    await expect(nanaPage.getByRole("heading", { name: EXCHANGE_NAME })).toBeVisible();
    await expect(nanaPage.getByText(/Olivia/).first()).toBeVisible();
  }, { required: true });

  await journey.step("Nana creates an account from the invite", nanaPage, async () => {
    await action(nanaPage, /sign up|create.*account/i).click();
    await expect(nanaPage).toHaveURL(/\/signup/);
    await signUpThroughForm(nanaPage, nana);
    await waitUntilSignedIn(nanaPage);
  }, { required: true });

  await journey.step("Nana lands back on the invite", nanaPage, async () => {
    await expect(nanaPage).toHaveURL(/\/join\/exchange\//, { timeout: 8_000 });
  });

  await journey.step("Nana gets to the join button", nanaPage, async () => {
    // Without the redirect, the only way back is finding the email again.
    if (!/\/join\/exchange\//.test(nanaPage.url())) await nanaPage.goto(nanaInvite);
    await expect(nanaPage.getByRole("button", { name: "Join Exchange" })).toBeVisible();
  }, { required: true });

  await journey.step("Nana joins", nanaPage, async () => {
    await nanaPage.getByRole("button", { name: "Join Exchange" }).click();
    await expect(nanaPage).toHaveURL(/\/exchanges\/family-christmas/);
  }, { required: true });

  await journey.step("Organizer sees everyone is in", page, async () => {
    await page.reload();
    await expect(page.getByText("5/5 joined")).toBeVisible();
  }, { required: true });

  await journey.step("Organizer is told when people join", null, async () => {
    await waitForMail(organizer.email, new RegExp(`Nana joined ${EXCHANGE_NAME}`));
  });

  await journey.step("A person who joins gets a confirmation", null, async () => {
    await waitForMail(nana.email, new RegExp(`You're in: ${EXCHANGE_NAME}`));
  });

  await journey.step("Keep the couple from drawing each other", page, async () => {
    await shown(page, "button", "Add Rule").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: organizer.firstName, exact: true }).click();
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: relatives[0].firstName, exact: true }).click();
    await dialog.getByRole("button", { name: "Add Rule" }).click();
    await expect(page.getByText("Exclusion rule added").first()).toBeVisible();
  }, { required: true });

  await journey.step("Draw the names", page, async () => {
    await shown(page, "button", /Publish Exchange|Draw names/).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("5 joined");
    await page.waitForTimeout(300);
  }, { required: true });

  await journey.step("Confirm the draw", page, async () => {
    await page.getByRole("dialog").getByRole("button", { name: /Publish Exchange|Draw names/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  }, { required: true });

  const everyone = [organizer, ...relatives, nana];
  const matchFor = new Map<string, string>();

  for (const person of everyone) {
    await journey.step(`${person.firstName} gets the names-are-in email`, null, async () => {
      await waitForMail(person.email, /The names are in/);
    });
  }

  for (const person of everyone) {
    const target = person === organizer ? page : sessions.get(person.firstName)!;
    await journey.step(`${person.firstName} opens the email and sees their match`, target, async () => {
      const mail = await waitForMail(person.email, /The names are in/);
      await target.goto(firstLink(mail, /http:\/\/localhost:3000\/exchanges\/\S+/));
      const reveal = target.locator("h1").filter({ hasText: "🎁" });
      await expect(reveal).toBeVisible({ timeout: 15_000 });
      matchFor.set(person.firstName, (await reveal.innerText()).replace("🎁", "").trim());
    });
  }

  await journey.step("The database holds one valid draw", null, async () => {
    const participants = rows<Match>(
      "SELECT p.id, p.name, p.email, p.matched_participant_id FROM exchange_participants p ORDER BY p.id"
    );
    expect(participants).toHaveLength(5);
    const ids = participants.map((participant) => participant.id).sort();
    const receivers = participants.map((participant) => participant.matched_participant_id).sort();
    expect(receivers).toEqual(ids);
    for (const participant of participants) {
      expect(participant.matched_participant_id).not.toBe(participant.id);
    }
    const couple = participants.filter((participant) =>
      [organizer.email, relatives[0].email].includes(participant.email)
    );
    expect(couple[0].matched_participant_id).not.toBe(couple[1].id);
    expect(couple[1].matched_participant_id).not.toBe(couple[0].id);
  });

  await journey.step("Nobody can find out who drew them", null, async () => {
    const leaks: string[] = [];
    for (const [who, responses] of received) {
      for (const { url, body } of responses) {
        const found: string[] = [];
        findMatchKeys(body, "", found);
        // Each person may see only their own assignment, under my_participant.
        leaks.push(...found.filter((key) => !/\.my_participant\.matched_/.test(key)).map((key) => `${who} ${url} ${key}`));
      }
    }
    expect(leaks).toEqual([]);

    const participants = rows<Match>("SELECT id, name, email, matched_participant_id FROM exchange_participants");
    const mail = await allMail();
    for (const message of mail.filter((item) => /names are in|Good news|needs a little help/.test(item.Subject))) {
      const body = await mailBody(message.ID);
      const recipient = participants.find((participant) => participant.email === message.To[0].Address)!;
      const giver = participants.find((participant) => participant.matched_participant_id === recipient.id)!;
      expect(`${body.Text} ${body.HTML}`, `email to ${recipient.name}`).not.toContain(giver.name.split(" ")[0]);
    }
  });

  await journey.step("No background job failed", null, async () => {
    expect(await failedJobs()).toBe(0);
  });

  for (const target of sessions.values()) await target.context().close();
  await owner.context.close();

  const secret = process.env.CLERK_SECRET_KEY ?? "";
  if (secret.startsWith("sk_test_")) {
    const clerkClient = createClerkClient({ secretKey: secret });
    const users = await clerkClient.users.getUserList({ emailAddress: [nana.email], limit: 1 });
    for (const user of users.data) await clerkClient.users.deleteUser(user.id);
  }

  journey.finish();
});
