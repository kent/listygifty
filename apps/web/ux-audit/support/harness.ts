import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { authStatePath, type E2EUser } from "../../e2e/support/test-users";

export type Persona = "busy-parent" | "new-relative";

type StepResult = { name: string; status: "pass" | "fail" | "skipped"; ms: number; note?: string; shot?: string };
type IssueEvent = { kind: "console" | "pageerror" | "http"; text: string; at: string; step: string };
type AxeFinding = { rule: string; impact: string; help: string; route: string; nodes: number; sample: string };

const ROOT = path.resolve(__dirname, "../../../../docs/ux-audit/runs");
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /Clerk has been loaded with development keys/,
  /\[Fast Refresh\]/,
  /\[HMR\]/,
];

// The Next.js dev badge exists only in local dev and would sit in every frame.
const SCREENSHOT_STYLE = "nextjs-portal { display: none !important; }";

export function runLabel(): string {
  return process.env.UX_RUN || "scratch";
}

/** Normalizes ids and tokens so one screen counts once in the axe roll-up. */
function routeOf(url: string): string {
  const { pathname } = new URL(url);
  return pathname
    .replace(/\/(exchanges)\/[^/]+/, "/$1/:slug")
    .replace(/\/(wishlists|holidays|people)\/\d+/, "/$1/:id")
    .replace(/\/(join\/exchange|w|claim|join\/x)\/[^/]+/, "/$1/:token")
    .replace(/\/e\/[^/]+\/[^/]+/, "/e/:slug/:token")
    .replace(/\/(new)$/, "/$1");
}

export class Journey {
  readonly steps: StepResult[] = [];
  readonly events: IssueEvent[] = [];
  readonly axe = new Map<string, AxeFinding>();
  readonly dir: string;
  clicks = 0;
  private current = "start";
  private aborted = false;
  private index = 0;
  private started = Date.now();

  constructor(
    readonly id: string,
    readonly persona: Persona,
    readonly task: string,
    readonly testInfo: TestInfo
  ) {
    this.dir = path.join(ROOT, runLabel(), testInfo.project.name, id);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /** Listens to one browser session: real clicks, console errors, failed API calls. */
  async watch(context: BrowserContext) {
    await context.exposeBinding("__uxClick", () => {
      this.clicks += 1;
    });
    await context.addInitScript(() => {
      document.addEventListener("click", () => (window as unknown as { __uxClick(): void }).__uxClick(), true);
    });
    context.on("page", (page) => this.watchPage(page));
    context.pages().forEach((page) => this.watchPage(page));
  }

  private watchPage(page: Page) {
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
      this.events.push({ kind: "console", text: text.slice(0, 300), at: page.url(), step: this.current });
    });
    page.on("pageerror", (error) => {
      this.events.push({ kind: "pageerror", text: error.message.slice(0, 300), at: page.url(), step: this.current });
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const url = response.url();
      const ours = url.startsWith("http://localhost:3001") || url.startsWith("http://localhost:3000");
      if (!ours && !url.includes(".clerk.accounts.dev")) return;
      this.events.push({
        kind: "http",
        text: `${response.status()} ${response.request().method()} ${new URL(url).pathname}`,
        at: page.url(),
        step: this.current,
      });
    });
  }

  /**
   * One thing a person is trying to do. A failed step is recorded and the
   * journey carries on, the way a stubborn user would, unless `required`
   * says nothing after it can work.
   */
  async step(name: string, page: Page | null, action: () => Promise<void>, options: { required?: boolean } = {}) {
    this.current = name;
    if (this.aborted) {
      this.steps.push({ name, status: "skipped", ms: 0 });
      return;
    }

    const started = Date.now();
    let status: StepResult["status"] = "pass";
    let note: string | undefined;
    try {
      await action();
    } catch (error) {
      status = "fail";
      note = (error instanceof Error ? error.message : String(error)).split("\n").slice(0, 3).join(" ").slice(0, 300);
      if (options.required) this.aborted = true;
    }
    const ms = Date.now() - started;
    const shot = page ? await this.capture(page, name) : undefined;
    this.steps.push({ name, status, ms, note, shot });
  }

  /** Saves the frame and audits exactly what is on screen at this step. */
  async capture(page: Page, name: string): Promise<string | undefined> {
    this.index += 1;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const file = `${String(this.index).padStart(2, "0")}-${slug}.png`;
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(this.dir, file), animations: "disabled", style: SCREENSHOT_STYLE });
      await this.audit(page);
      return file;
    } catch {
      return undefined;
    }
  }

  private async audit(page: Page) {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude("nextjs-portal").analyze();
    const route = routeOf(page.url());
    for (const violation of results.violations) {
      const key = `${route}|${violation.id}`;
      const existing = this.axe.get(key);
      const nodes = Math.max(existing?.nodes ?? 0, violation.nodes.length);
      this.axe.set(key, {
        rule: violation.id,
        impact: violation.impact ?? "unknown",
        help: violation.help,
        route,
        nodes,
        sample: violation.nodes[0]?.target.join(" ").slice(0, 160) ?? "",
      });
    }
  }

  /** Writes the metrics and fails the test if the person could not finish. */
  finish() {
    const failed = this.steps.filter((step) => step.status === "fail");
    const skipped = this.steps.filter((step) => step.status === "skipped");
    const metrics = {
      id: this.id,
      persona: this.persona,
      task: this.task,
      project: this.testInfo.project.name,
      pass: failed.length === 0 && skipped.length === 0,
      clicks: this.clicks,
      activeMs: this.steps.reduce((total, step) => total + step.ms, 0),
      wallMs: Date.now() - this.started,
      errors: this.events.length,
      steps: this.steps,
      events: this.events,
      axe: [...this.axe.values()],
    };
    fs.writeFileSync(path.join(this.dir, "metrics.json"), JSON.stringify(metrics, null, 2));
    expect(failed.map((step) => `${step.name}: ${step.note}`), "steps the person could not finish").toEqual([]);
    expect(skipped.map((step) => step.name), "steps never reached").toEqual([]);
  }
}

type SessionOptions = {
  role?: E2EUser["role"];
  /** Forces a phone, for the relative who only ever opens this on one. */
  phone?: boolean;
};

/** A separate browser profile with the run's theme and viewport, fully watched. */
export async function openSession(
  browser: Browser,
  journey: Journey,
  options: SessionOptions = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const { use, metadata } = journey.testInfo.project;
  const phone = options.phone ?? Boolean(use.isMobile);
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    deviceScaleFactor: phone ? 2 : 1,
    timezoneId: "America/Toronto",
    storageState: options.role ? authStatePath(options.role) : undefined,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript((theme) => {
    try {
      window.localStorage.setItem("listygifty-theme", theme);
    } catch {
      // Storage is unavailable until the first real navigation.
    }
  }, String(metadata.theme));
  await journey.watch(context);
  return { context, page: await context.newPage() };
}

/** Both theme headers stay in the DOM, so only count what a person can see. */
export function shown(page: Page, role: Parameters<Page["getByRole"]>[0], name: string | RegExp) {
  return page.getByRole(role, { name }).locator("visible=true").first();
}

/** A control that may be a link or a button; people can't tell and don't care. */
export function action(page: Page, name: string | RegExp) {
  return page.getByRole("link", { name }).or(page.getByRole("button", { name })).locator("visible=true").first();
}

/** Same as a person tapping it: the nav scrolls sideways on phones. */
export async function goToNav(page: Page, label: string | RegExp) {
  const item = shown(page, "link", label);
  await item.scrollIntoViewIfNeeded();
  await item.click();
}
