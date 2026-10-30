import { expect, type Page } from "@playwright/test";
import { rows } from "./local";

/** Calls the API as whoever is signed in on this page, for fast scenario setup. */
export async function api<T = unknown>(page: Page, method: string, path: string, body?: unknown) {
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session));
  return page.evaluate(
    async ({ method, path, body }) => {
      const clerk = (window as unknown as { Clerk: { session: { getToken(): Promise<string> } } }).Clerk;
      const token = await clerk.session.getToken();
      const response = await fetch(`http://localhost:3001${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
    },
    { method, path, body }
  ) as Promise<{ status: number; body: T }>;
}

export async function signedIn(page: Page) {
  await page.goto("/dashboard");
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session)), {
      timeout: 15_000,
    })
    .toBe(true);
  // A first page load creates the local user; wait so setup calls don't race it.
  await page.waitForTimeout(1_200);
}

export type SeededExchange = { id: number; slug: string };

export async function seedExchange(
  owner: Page,
  name: string,
  invitees: Array<{ name: string; email: string }>
): Promise<SeededExchange> {
  const created = await api<SeededExchange>(owner, "POST", "/gift_exchanges", {
    gift_exchange: { name, exchange_date: `${new Date().getFullYear()}-12-25`, budget_max: 50 },
  });
  expect(created.status).toBe(201);
  for (const invitee of invitees) {
    const added = await api(owner, "POST", `/gift_exchanges/${created.body.id}/exchange_participants`, {
      exchange_participant: invitee,
    });
    expect(added.status).toBe(201);
  }
  return created.body;
}

export function inviteToken(email: string): string {
  return rows<{ invite_token: string }>(
    `SELECT invite_token FROM exchange_participants WHERE email = '${email}' ORDER BY id DESC LIMIT 1`
  )[0].invite_token;
}

export async function acceptInvite(page: Page, email: string) {
  const accepted = await api(page, "POST", `/exchange_invite/${inviteToken(email)}/accept`);
  expect(accepted.status).toBe(200);
}
