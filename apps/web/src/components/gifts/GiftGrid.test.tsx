import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { GiftGrid } from "./GiftGrid";
import { giftsService } from "@/services";

vi.mock("@/services", () => ({ giftsService: { getAll: vi.fn() } }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ canCreateGift: true, isPremium: true, refreshBillingStatus: vi.fn() }) }));
vi.mock("@/components/upgrade-prompt", () => ({ UpgradePrompt: () => null }));
vi.mock("./SortableGiftRow", () => ({ SortableGiftRow: () => null }));
vi.mock("./MobileGiftCard", () => ({ MobileGiftCard: () => null }));
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
