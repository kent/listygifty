import { expect, test, type Page } from "@playwright/test";

const MCP_OAUTH_URL = `${(process.env.NEXT_PUBLIC_API_URL || "https://api.listygifty.com").replace(/\/+$/, "")}/mcp`;

async function expectMcpOAuthCard(page: Page) {
  await page.goto("/settings");

  const card = page.getByTestId("mcp-oauth-url-card");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Your MCP OAuth URL" })).toBeVisible();
  await expect(card.getByText(MCP_OAUTH_URL, { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Copy MCP OAuth URL" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(MCP_OAUTH_URL);

  const bounds = await card.boundingBox();
  const codeBounds = await card.locator("code").boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(codeBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(codeBounds!.x + codeBounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("shows the MCP OAuth URL prominently in desktop settings", async ({ page }) => {
  await expectMcpOAuthCard(page);
});

test.describe("mobile web settings", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the MCP OAuth URL visible, copyable, and within the viewport", async ({ page }) => {
    await expectMcpOAuthCard(page);
  });
});
