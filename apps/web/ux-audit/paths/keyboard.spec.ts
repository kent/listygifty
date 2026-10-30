import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USERS } from "../../e2e/support/test-users";
import { signedIn } from "../support/api";
import { Journey, openSession } from "../support/harness";
import { clearMail, resetLocalData } from "../support/local";

const MAX_TABS = 80;

type Focused = { label: string; ring: boolean };

async function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return { label: "", ring: false };
    const style = getComputedStyle(element);
    const label = [
      element.getAttribute("aria-label"),
      element.innerText,
      (element as HTMLInputElement).placeholder,
      element.getAttribute("title"),
      (element as HTMLInputElement).labels?.[0]?.innerText,
    ].filter(Boolean).join(" ").trim();
    const ring =
      (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
      (style.boxShadow !== "none" && style.boxShadow !== "") ||
      style.borderColor !== "";
    return { label, ring: ring && (style.outlineStyle !== "none" || style.boxShadow !== "none") };
  });
}

/** Presses Tab until the control is reached, failing if it can't be. */
async function tabTo(page: Page, name: RegExp) {
  for (let press = 0; press < MAX_TABS; press += 1) {
    await page.keyboard.press("Tab");
    const current = await focused(page);
    if (name.test(current.label)) {
      expect(current.ring, `focus ring on ${current.label}`).toBe(true);
      return;
    }
  }
  throw new Error(`Tab never reached ${name}`);
}

/** The dialog may already have focused the control, so check before pressing Tab. */
async function tabUntilFocused(page: Page, target: Locator) {
  for (let press = 0; press < MAX_TABS; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the control");
}

async function unlabelledStops(page: Page, stops: number) {
  const unnamed: string[] = [];
  for (let press = 0; press < stops; press += 1) {
    await page.keyboard.press("Tab");
    const element = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const name = el.getAttribute("aria-label") || el.innerText || (el as HTMLInputElement).placeholder || "";
      return name.trim() ? null : el.outerHTML.slice(0, 120);
    });
    if (element) unnamed.push(element);
  }
  return unnamed;
}

test.skip(({ isMobile }) => isMobile, "Keyboard passes are desktop only");

test("keyboard only: exchange and wishlist work without a mouse", async ({ browser }, testInfo) => {
  resetLocalData();
  await clearMail();
  const journey = new Journey("k1-keyboard", "busy-parent", "Do journeys 2 and 5 with only the keyboard.", testInfo);
  const { page, context } = await openSession(browser, journey, { role: "owner" });
  await signedIn(page);

  await journey.step("Reach New Exchange by keyboard", page, async () => {
    await page.goto("/exchanges");
    await page.getByRole("heading", { name: "Gift Exchanges" }).waitFor();
    await tabTo(page, /Create Your First Exchange|New Exchange/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/exchanges\/new/);
  }, { required: true });

  await journey.step("Fill and submit the exchange form by keyboard", page, async () => {
    await page.getByLabel("Exchange Name *").waitFor();
    await tabTo(page, /Exchange Name/);
    await page.keyboard.type("Keyboard Exchange");
    await tabTo(page, /Create Exchange/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/exchanges\/keyboard-exchange/, { timeout: 15_000 });
  }, { required: true });

  await journey.step("Invite someone by keyboard", page, async () => {
    await page.getByTestId("participant-roster").waitFor();
    await tabTo(page, /^\s*Add\s*$/);
    await page.keyboard.press("Enter");
    await page.getByLabel("Name").waitFor();
    await page.keyboard.type(`${E2E_USERS[1].firstName} ${E2E_USERS[1].lastName}`);
    await page.keyboard.press("Tab");
    await page.keyboard.type(E2E_USERS[1].email);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("participant-roster")).toContainText(E2E_USERS[1].firstName);
  }, { required: true });

  await journey.step("Every control in the roster has a name", page, async () => {
    expect(await unlabelledStops(page, 14)).toEqual([]);
  });

  await journey.step("Add a rule by keyboard", page, async () => {
    await page.reload();
    await page.getByTestId("participant-roster").waitFor();
    await tabTo(page, /^\s*Add Rule\s*$/);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    for (const index of [0, 1]) {
      await tabUntilFocused(page, dialog.getByRole("combobox").nth(index));
      await page.keyboard.press("Enter");
      await page.getByRole("listbox").waitFor();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("listbox")).toHaveCount(0);
    }
    await expect(dialog.getByRole("button", { name: "Add Rule" })).toBeEnabled();
    await page.keyboard.press("Escape");
  });

  await journey.step("Reach New Wishlist by keyboard", page, async () => {
    await page.goto("/wishlists");
    await page.getByRole("heading", { name: "Wishlists" }).first().waitFor();
    await tabTo(page, /Create Your First Wishlist|New Wishlist/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/wishlists\/new/);
  }, { required: true });

  await journey.step("Create a wishlist by keyboard", page, async () => {
    await page.getByPlaceholder(/Birthday Wishlist/).waitFor();
    await tabTo(page, /Birthday Wishlist/);
    await page.keyboard.type("Keyboard list");
    await tabTo(page, /Create Wishlist/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/wishlists\/\d+/, { timeout: 15_000 });
  }, { required: true });

  await journey.step("Add an item by keyboard", page, async () => {
    await page.getByText(/No Items Yet/).waitFor();
    await tabTo(page, /Add Your First Item/);
    await page.keyboard.press("Enter");
    await page.getByPlaceholder("Item name").waitFor();
    await page.keyboard.type("Typed gift");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Typed gift").first()).toBeVisible();
  }, { required: true });

  await journey.step("Item actions can be reached and named by keyboard", page, async () => {
    await page.reload();
    await page.getByText("Typed gift").first().waitFor();
    expect(await unlabelledStops(page, 16)).toEqual([]);
  });

  await context.close();
  journey.finish();
});
