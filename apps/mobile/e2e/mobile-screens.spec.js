const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const baseURL = process.env.SCREEN_BASE_URL || "http://127.0.0.1:19008";
const artifactRoot = path.join(process.cwd(), "build-artifacts", "screen-verification");

const routes = [
  "auth-login",
  "auth-signup",
  "lists",
  "list-detail",
  "list-new",
  "gift-new",
  "gift-quick-new",
  "gift-detail",
  "exchanges",
  "exchange-detail",
  "exchange-new",
  "exchange-participant-new",
  "exchange-wishlist",
  "exchange-wishlist-new",
  "match",
  "invite",
  "people",
  "profile",
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

const failurePatterns = [
  /Unable to resolve module/i,
  /Uncaught/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /TypeError/i,
  /Failed to load/i,
  /Page could not be found/i,
  /Something went wrong/i,
  /Unmatched Route/i,
];

function isIgnoredConsoleError(message) {
  return /Failed to load resource: the server responded with a status of 400/i.test(message);
}

function routeURL(route) {
  return `${baseURL}/?screenshotRoute=${encodeURIComponent(route)}`;
}

async function pageMetrics(page) {
  return page.evaluate(() => ({
    bodyTextLength: document.body.innerText.trim().length,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} mobile app screens`, () => {
    test.use({
      colorScheme: "light",
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const route of routes) {
      test(route, async ({ page }, testInfo) => {
        const consoleFailures = [];

        page.on("console", (message) => {
          if (message.type() === "error" && !isIgnoredConsoleError(message.text())) {
            consoleFailures.push(message.text());
          }
        });
        page.on("pageerror", (error) => {
          consoleFailures.push(error.message);
        });

        await page.addInitScript(() => {
          window.__layoutShiftScore = 0;
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  window.__layoutShiftScore += entry.value || 0;
                }
              }
            }).observe({ type: "layout-shift", buffered: true });
          } catch {
            window.__layoutShiftScore = 0;
          }
        });

        const response = await page.goto(routeURL(route), {
          timeout: 30000,
          waitUntil: "domcontentloaded",
        });
        expect(response?.ok(), `${route} returned an HTTP error`).toBeTruthy();

        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(1200);

        const text = await page.locator("body").innerText({ timeout: 5000 });
        expect(text.trim().length, `${route} rendered a blank body`).toBeGreaterThan(10);
        for (const pattern of failurePatterns) {
          expect(text, `${route} rendered ${pattern}`).not.toMatch(pattern);
        }

        const before = await pageMetrics(page);
        const screenshotDir = path.join(artifactRoot, viewport.name);
        fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, `${route}.png`);
        await page.screenshot({ fullPage: true, path: screenshotPath });
        await testInfo.attach(`${viewport.name}-${route}`, {
          contentType: "image/png",
          path: screenshotPath,
        });

        await page.waitForTimeout(600);
        const after = await pageMetrics(page);
        const layoutShiftScore = await page.evaluate(() => window.__layoutShiftScore || 0);

        expect(consoleFailures, `${route} had console/page errors`).toEqual([]);
        expect(layoutShiftScore, `${route} had high layout shift`).toBeLessThan(0.1);
        expect(after.scrollWidth, `${route} width changed after settle`).toBe(before.scrollWidth);
        expect(after.scrollHeight, `${route} height changed after settle`).toBe(before.scrollHeight);
        expect(after.bodyTextLength, `${route} text changed after settle`).toBe(
          before.bodyTextLength
        );
      });
    }
  });
}
