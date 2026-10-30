import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { MobileGiftCard } from "./MobileGiftCard";

vi.mock("@/services", () => ({ peopleService: { create: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ captureWebEvent: vi.fn() }));

const gift = {
  id: 1,
  name: "Lego set",
  link: null,
  cost: "24.50",
  is_mine: true,
  holiday_id: 5,
  gift_status_id: 1,
  gift_status: { id: 1, name: "Idea", color: null },
  recipients: [],
  givers: [],
} as unknown as Gift;

function renderCard(overrides: Partial<Gift> = {}) {
  return render(
    <MobileGiftCard
      gift={{ ...gift, ...overrides }}
      people={[]}
      statuses={[{ id: 1, name: "Idea" }] as GiftStatus[]}
      isDeleting={false}
      onUpdateGift={vi.fn()}
      onUpdateRecipients={vi.fn()}
      onUpdateGivers={vi.fn()}
      onRequestDelete={vi.fn()}
      onPersonCreated={vi.fn()}
    />
  );
}

function expand() {
  fireEvent.click(screen.getByRole("button", { name: /^Lego set/ }));
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

// A bare dark palette class is unreadable in the light Apple theme. Classes with
// a dark: prefix are fine, since they only apply under the dark Festive theme.
const DARK_ONLY = /^(text-white|text-slate-|bg-slate-|border-slate-|text-violet-[34]00|text-cyan-400|text-red-400)/;

function darkOnlyClasses(container: HTMLElement) {
  return [...container.querySelectorAll("*")]
    .flatMap((element) => [...element.classList])
    .filter((name) => DARK_ONLY.test(name));
}

describe("mobile gift card in the light theme", () => {
  const shared = { is_mine: false, link: "https://example.com/lego" };

  it("uses no dark-only colours when collapsed", () => {
    const { container } = renderCard(shared);
    expect(darkOnlyClasses(container)).toEqual([]);
  });

  it("uses no dark-only colours when expanded", () => {
    const { container } = renderCard(shared);
    fireEvent.click(screen.getByRole("button", { name: /^Lego set/ }));
    expect(darkOnlyClasses(container)).toEqual([]);
  });
});

describe("mobile gift card labels", () => {
  it("connects every visible label to its control", () => {
    renderCard();
    expand();
    for (const label of ["Name", "To", "From", "Status", "Cost"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("gives each card its own ids so two cards don't collide", () => {
    renderCard();
    expand();
    expect(screen.getByLabelText("Status").id).toContain("1");
  });

  it("reports whether the card is expanded", () => {
    renderCard();
    const toggle = screen.getByRole("button", { name: /^Lego set/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("mobile gift card control names", () => {
  it("names every edit control after the gift", () => {
    renderCard();
    expand();
    expect(screen.getByRole("button", { name: "Edit gift name: Lego set" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "To: recipients of Lego set" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "From: givers of Lego set" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Status of Lego set" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit cost of Lego set: $24.50" })).toBeTruthy();
  });
});
