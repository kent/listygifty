import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { SortableGiftRow } from "./SortableGiftRow";

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
  gift_status: { id: 1, name: "Idea" },
  recipients: [],
  givers: [],
  gift_recipients: [],
  created_at: "2026-01-01T00:00:00Z",
} as unknown as Gift;

function renderRow(overrides: Partial<Gift> = {}) {
  render(
    <DndContext>
      <SortableContext items={[1]}>
        <table><tbody>
          <SortableGiftRow
            gift={{ ...gift, ...overrides }}
            people={[]}
            statuses={[{ id: 1, name: "Idea" }] as GiftStatus[]}
            addresses={[]}
            showAddresses={false}
            deletingId={null}
            onUpdateGift={vi.fn()}
            onUpdateRecipients={vi.fn()}
            onUpdateGivers={vi.fn()}
            onUpdateRecipientAddress={vi.fn()}
            onInsertGift={vi.fn()}
            onRequestDelete={vi.fn()}
            onPersonCreated={vi.fn()}
          />
        </tbody></table>
      </SortableContext>
    </DndContext>
  );
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("gift row controls", () => {
  it("names the row menu after the gift", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Actions for Lego set" })).toBeTruthy();
  });

  it("keeps the row menu visible on keyboard focus, while open, and without hover", () => {
    renderRow();
    const menu = screen.getByRole("button", { name: "Actions for Lego set" });
    expect(menu.className).toContain("focus-visible:opacity-100");
    expect(menu.className).toContain("data-[state=open]:opacity-100");
    expect(menu.className).toContain("[@media(hover:none)]:opacity-100");
  });

  it("names the drag handle after the gift and keeps it keyboard reachable", () => {
    renderRow();
    const handle = screen.getByRole("button", { name: "Reorder Lego set" });
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("gives the drag handle a visible focus state and shows it without hover", () => {
    renderRow();
    const handle = screen.getByRole("button", { name: "Reorder Lego set" });
    expect(handle.className).toContain("focus-visible:ring-2");
    expect(handle.className).toContain("focus-visible:ring-ring");
    expect(handle.className).toContain("[@media(hover:none)]:opacity-100");
  });

  it("names the recipient and giver pickers after the gift", () => {
    renderRow();
    expect(screen.getByRole("combobox", { name: "To: recipients of Lego set" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "From: givers of Lego set" })).toBeTruthy();
  });

  it("still names the controls of a gift with no name yet", () => {
    renderRow({ name: "" });
    expect(screen.getByRole("button", { name: "Actions for untitled gift" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reorder untitled gift" })).toBeTruthy();
  });
});
