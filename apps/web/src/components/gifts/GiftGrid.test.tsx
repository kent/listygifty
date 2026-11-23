import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { GiftGrid } from "./GiftGrid";
import { giftsService } from "@/services";

const { scrollIntoView } = vi.hoisted(() => ({ scrollIntoView: vi.fn() }));

vi.mock("@/services", () => ({ giftsService: { getAll: vi.fn() } }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ canCreateGift: true, isPremium: true, refreshBillingStatus: vi.fn() }) }));
vi.mock("@/components/upgrade-prompt", () => ({ UpgradePrompt: () => null }));
vi.mock("./SortableGiftRow", () => ({
  SortableGiftRow: ({ gift, isLinked }: { gift: Gift; isLinked: boolean }) => (
    <tr
      ref={(node) => { if (node) node.scrollIntoView = scrollIntoView; }}
      data-testid={`desktop-${gift.id}`}
      data-linked-gift={isLinked ? "" : undefined}
      tabIndex={isLinked ? -1 : undefined}
    >
      <td>{gift.name}</td>
    </tr>
  ),
}));
vi.mock("./MobileGiftCard", () => ({
  MobileGiftCard: ({ gift, isLinked }: { gift: Gift; isLinked: boolean }) => (
    <div
      ref={(node) => { if (node) node.scrollIntoView = scrollIntoView; }}
      data-testid={`mobile-${gift.id}`}
      data-linked-gift={isLinked ? "" : undefined}
      tabIndex={isLinked ? -1 : undefined}
    >
      {gift.name}
    </div>
  ),
}));
vi.mock("./NewGiftDialog", () => ({
  NewGiftDialog: ({ onGiftCreated }: { onGiftCreated: (gift: Gift) => void }) => (
    <button onClick={() => onGiftCreated({ id: nextId++, position: 0 } as Gift)}>Save gift</button>
  ),
}));
vi.mock("@/lib/analytics", () => ({ captureWebEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let nextId = 1;

function Harness() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  return <>
    <output data-testid="gift-ids">{gifts.map((gift) => gift.id).join(",")}</output>
    <GiftGrid gifts={gifts} allGifts={gifts} people={[]} statuses={[{ id: 1 } as GiftStatus]}
      holidays={[]} addresses={[]} showAddresses={false} defaultHolidayId={1}
      onGiftsChange={setGifts} onPeopleChange={() => {}} />
  </>;
}

function deferred() {
  let resolve!: (gifts: Gift[]) => void;
  const promise = new Promise<Gift[]>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("gift capture list refresh", () => {
  it("keeps the latest gifts when repeat-entry refreshes finish out of order", async () => {
    nextId = 1;
    const older = deferred();
    const newer = deferred();
    vi.mocked(giftsService.getAll).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Save gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Save gift" }));
    expect(screen.getByTestId("gift-ids").textContent).toBe("2,1");
    await act(async () => newer.resolve([{ id: 2, holiday_id: 1, position: 0 }, { id: 1, holiday_id: 1, position: 1 }] as Gift[]));
    await act(async () => older.resolve([{ id: 1, holiday_id: 1, position: 0 }] as Gift[]));
    expect(screen.getByTestId("gift-ids").textContent).toBe("2,1");
  });
});

it.each(["desktop", "mobile"])("focuses the requested gift on %s even when two gifts have the same name", (layout) => {
  scrollIntoView.mockClear();
  const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return { length: this.dataset.testid?.startsWith(`${layout}-`) ? 1 : 0 } as DOMRectList;
  });
  try {
    const gifts = [
      { id: 1, holiday_id: 1, position: 0, name: "Puzzle" },
      { id: 2, holiday_id: 1, position: 1, name: "Puzzle" },
    ] as Gift[];
    render(
      <GiftGrid gifts={gifts} allGifts={gifts} linkedGiftId={2} people={[]} statuses={[]} holidays={[]}
        addresses={[]} showAddresses={false} onGiftsChange={() => {}} onPeopleChange={() => {}} />
    );

    expect(screen.getByTestId("desktop-1").hasAttribute("data-linked-gift")).toBe(false);
    expect(screen.getByTestId("mobile-1").hasAttribute("data-linked-gift")).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId(`${layout}-2`));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  } finally {
    rects.mockRestore();
  }
});
