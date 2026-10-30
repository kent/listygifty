import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Gift, Person } from "@niftygifty/types";
import { darkOnlyClasses } from "@/test/dark-only";
import { SharedGiftEditDialog } from "./SharedGiftEditDialog";

vi.mock("@/services", () => ({
  giftsService: { update: vi.fn() },
  peopleService: { create: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const people = [{ id: 7, name: "Alex" }, { id: 8, name: "Sam" }] as Person[];
const gift = {
  id: 1,
  name: "Lego set",
  description: "The big one",
  link: "https://example.com/lego",
  cost: "40.00",
  gift_status: { name: "Idea" },
  recipients: [{ id: 7 }, { id: 8 }],
  givers: [{ id: 7 }],
} as unknown as Gift;

// Radix Popover and cmdk measure and scroll; jsdom implements neither.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});

function renderDialog(overrides: Partial<Gift> = {}) {
  render(
    <SharedGiftEditDialog
      gift={{ ...gift, ...overrides }}
      people={people}
      open
      onOpenChange={vi.fn()}
      onGiftUpdated={vi.fn()}
      onPersonCreated={vi.fn()}
    />
  );
}

describe("shared gift dialog", () => {
  it("names both people pickers from their visible labels", () => {
    renderDialog();
    expect(screen.getByRole("combobox", { name: "To (Recipients)" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "From (Givers)" })).toBeTruthy();
  });

  it("connects every label to a control", () => {
    renderDialog();
    const labels = [...screen.getByRole("dialog").querySelectorAll("label")];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.control).toBeTruthy();
    }
  });

  it("shows no em dash when a gift has no cost", () => {
    renderDialog({ cost: null } as Partial<Gift>);
    expect(screen.getByRole("dialog").textContent).not.toContain("—");
  });

  it("uses no dark-only colours", () => {
    renderDialog();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });
});
