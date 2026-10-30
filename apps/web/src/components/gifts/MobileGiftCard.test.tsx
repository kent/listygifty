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
