import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { allMail, clearMail, mailBody, resetLocalData } from "../support/local";

test("every email the app can send arrives in Mailpit with working parts", async ({}, testInfo) => {
  // One run is enough: this exercises SMTP, not a viewport.
  test.skip(testInfo.project.name !== "desktop-apple", "Runs once");

  resetLocalData();
  await clearMail();

  const script = fs.readFileSync(path.resolve(__dirname, "../support/send_every_email.rb"), "utf8");
  fs.writeFileSync(testInfo.outputPath("send.rb"), script);
  const output = execFileSync(
    "docker",
    ["exec", "-i", "listygifty-local-api", "bin/rails", "runner", "-"],
    { input: script, encoding: "utf8", timeout: 60_000 }
  );
  const sent = output.split("\n").filter((line) => line.startsWith("SENT "));
  expect(sent.length).toBe(15);

  await expect.poll(async () => (await allMail()).length, { timeout: 20_000 }).toBe(sent.length);

  const results: Array<{ subject: string; to: string; text: boolean; html: boolean; links: number; bad: string[] }> = [];
  for (const mail of await allMail()) {
    const body = await mailBody(mail.ID);
    const links = [...`${body.Text} ${body.HTML}`.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((match) => match[0]);
    const app = links.filter((link) => link.includes("localhost"));
    results.push({
      subject: mail.Subject,
      to: mail.To[0].Address,
      text: body.Text.trim().length > 0,
      html: body.HTML.trim().length > 0,
      links: app.length,
      bad: app.filter((link) => !link.startsWith("http://localhost:3000")),
    });
  }

  const report = path.resolve(__dirname, "../../../../docs/ux-audit/runs/email-delivery.json");
  fs.writeFileSync(report, JSON.stringify(results, null, 2));

  for (const result of results) {
    expect(result.to, result.subject).toMatch(/@example\.com$/);
    expect(result.text, `${result.subject} text part`).toBe(true);
    expect(result.html, `${result.subject} html part`).toBe(true);
    expect(result.bad, `${result.subject} links`).toEqual([]);
  }
});
