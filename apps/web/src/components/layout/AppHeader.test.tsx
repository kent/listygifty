import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ isPremium: false, billingStatus: null }) }));
vi.mock("@/components/workspace/WorkspaceSwitcher", () => ({ WorkspaceSwitcher: () => null }));

const renderHeader = () => render(<AppHeader user={null} onSignOut={() => {}} />);
const menus = () => screen.getAllByRole("navigation", { name: "Main menu" });

// jsdom has no layout, so these give the menu a phone-sized box to scroll in.
function layOutMenu({ width, contentWidth, activeLeft = 0 }: { width: number; contentWidth: number; activeLeft?: number }) {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(contentWidth);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const box = this.matches('[aria-current="page"]') ? { left: activeLeft, width: 80 } : { left: 0, width };
    return new DOMRect(box.left, 0, box.width, 40);
  });
}

beforeEach(() => {
  mocks.pathname = "/dashboard";
});

describe("app header menu", () => {
  it("puts Wishlists right after Gift Lists in every header variant", () => {
    renderHeader();
    expect(menus()).toHaveLength(3);
    for (const menu of menus()) {
      const labels = within(menu).getAllByRole("link").map((link) => link.textContent?.replace(/F\d+$/, ""));
      expect(labels).toEqual(["Home", "Gift Lists", "Wishlists", "Exchanges", "People", "Options"]);
      expect(within(menu).getByRole("link", { name: /Wishlists/ }).getAttribute("href")).toBe("/wishlists");
    }
  });

  it.each(["/wishlists", "/wishlists/12"])("marks Wishlists as the current page on %s in every variant", (pathname) => {
    mocks.pathname = pathname;
    renderHeader();
    for (const menu of menus()) {
      const current = within(menu).getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
      expect(current.map((link) => link.getAttribute("href"))).toEqual(["/wishlists"]);
    }
  });

  it("gives Wishlists its own function key and leaves F5 and F7 to the browser", () => {
    renderHeader();
    const [festiveMenu] = menus();
    const keys = within(festiveMenu).getAllByRole("link").map((link) => /F\d+$/.exec(link.textContent ?? "")?.[0]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("F5");
    expect(keys).not.toContain("F7");
    fireEvent.keyDown(window, { key: "F8" });
    expect(mocks.push).toHaveBeenCalledWith("/wishlists");
  });

  it("centers the current item in a menu too narrow to show it", () => {
    mocks.pathname = "/settings";
    layOutMenu({ width: 390, contentWidth: 640, activeLeft: 500 });
    renderHeader();
    for (const menu of menus()) expect(menu.scrollLeft).toBe(345);
  });

  it("does not scroll or fade a menu that fits", () => {
    layOutMenu({ width: 1000, contentWidth: 1000, activeLeft: 460 });
    renderHeader();
    for (const menu of menus()) {
      expect(menu.scrollLeft).toBe(0);
      expect(menu.style.maskImage).toBe("");
    }
  });

  it("fades only the edges that have more items past them", () => {
    layOutMenu({ width: 390, contentWidth: 640 });
    renderHeader();
    const [menu] = menus();
    expect(menu.style.maskImage).toContain("black 0px");
    expect(menu.style.maskImage).toContain("calc(100% - 1.75rem)");

    fireEvent.scroll(menu, { target: { scrollLeft: 100 } });
    expect(menu.style.maskImage).toContain("black 1.75rem");
    expect(menu.style.maskImage).toContain("calc(100% - 1.75rem)");

    fireEvent.scroll(menu, { target: { scrollLeft: 250 } });
    expect(menu.style.maskImage).toContain("black 1.75rem");
    expect(menu.style.maskImage).toContain("calc(100% - 0px)");
  });

  it("updates the fade when the window resizes", () => {
    layOutMenu({ width: 1000, contentWidth: 640 });
    renderHeader();
    const [menu] = menus();
    expect(menu.style.maskImage).toBe("");
    layOutMenu({ width: 390, contentWidth: 640 });
    fireEvent(window, new Event("resize"));
    expect(menu.style.maskImage).toContain("calc(100% - 1.75rem)");
  });
});
