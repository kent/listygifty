import { execFileSync } from "node:child_process";
import { expect } from "@playwright/test";

const MAILPIT = "http://localhost:8025/api/v1";

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "listygifty-local-postgres", "psql", "-U", "listygifty", "-d", "niftygifty_development", "-Atq", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8" }
  ).trim();
}

export const query = psql;

/** Rows as objects, for checking what the database really holds. */
export function rows<T>(sql: string): T[] {
  const json = psql(`SELECT coalesce(json_agg(t), '[]') FROM (${sql}) t;`);
  return JSON.parse(json) as T[];
}

/**
 * Empties everything a user can create, keeping lookups and the job tables the
 * running worker depends on, so each journey starts as a first-time user.
 */
export function resetLocalData() {
  psql(`
    BEGIN;
    SET LOCAL session_replication_role = replica;
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('schema_migrations', 'ar_internal_metadata', 'gift_statuses', 'holidays', 'oauth_clients')
          AND tablename NOT LIKE 'solid_queue_%'
      LOOP
        EXECUTE format('DELETE FROM %I', t.tablename);
      END LOOP;
    END $$;
    DELETE FROM holidays WHERE is_template = false;
    DELETE FROM solid_queue_blocked_executions;
    DELETE FROM solid_queue_ready_executions;
    DELETE FROM solid_queue_scheduled_executions;
    DELETE FROM solid_queue_failed_executions;
    DELETE FROM solid_queue_jobs WHERE id NOT IN (SELECT job_id FROM solid_queue_claimed_executions);
    COMMIT;
  `);
}

export async function clearMail() {
  await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
}

export type Mail = { ID: string; Subject: string; To: Array<{ Address: string }> };

export async function allMail(): Promise<Mail[]> {
  const response = await fetch(`${MAILPIT}/messages?limit=500`);
  return ((await response.json()) as { messages: Mail[] }).messages;
}

export async function mailBody(id: string): Promise<{ Text: string; HTML: string; Subject: string }> {
  const response = await fetch(`${MAILPIT}/message/${id}`);
  return (await response.json()) as { Text: string; HTML: string; Subject: string };
}

/** Waits for a real message in Mailpit, the same one a person would open. */
export async function waitForMail(to: string, subject: RegExp): Promise<{ Text: string; HTML: string; Subject: string }> {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        found = (await allMail()).find(
          (mail) => subject.test(mail.Subject) && mail.To.some((address) => address.Address === to)
        );
        return Boolean(found);
      },
      { timeout: 20_000, message: `mail to ${to} matching ${subject}` }
    )
    .toBe(true);
  return mailBody(found!.ID);
}

export function firstLink(body: { Text: string }, pattern: RegExp): string {
  const link = body.Text.match(pattern)?.[0];
  if (!link) throw new Error(`No link matching ${pattern} in the email`);
  return link;
}

export async function failedJobs(): Promise<number> {
  return Number(psql("SELECT count(*) FROM solid_queue_failed_executions;"));
}
