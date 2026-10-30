import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Gift, MatchArrangement, Person } from "@niftygifty/types";
import { giftsService } from "@/services";
import { MatchWorkspace } from "./MatchWorkspace";
import { skipTopLayerCheck } from "./skip-top-layer-check";

vi.mock("@/services", () => ({
  giftsService: { update: vi.fn() },
  peopleService: { create: vi.fn() },
  matchArrangementsService: { create: vi.fn(), update: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const people = [
  { id: 7, name: "Alex" },
  { id: 8, name: "Sam" },
  { id: 9, name: "Priya" },
] as Person[];

const sharedGift = {
  id: 1,
  name: "Board game",
  description: null,
  link: null,
  cost: "40.00",
  gift_status: { name: "Idea" },
  recipients: [{ id: 7, name: "Alex" }, { id: 8, name: "Sam" }],
  givers: [{ id: 9, name: "Priya" }],
} as unknown as Gift;

const arrangement = {
  id: 3,
  person_ids: [7, 8],
  slots: [],
  groupings: [],
} as unknown as MatchArrangement;

// Radix Popover and cmdk measure and scroll; jsdom implements neither.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(skipTopLayerCheck);

function renderWorkspace(gifts: Gift[] = [sharedGift]) {
  render(
    <MatchWorkspace
      holidayId={1}
      gifts={gifts}
      people={people}
      statuses={[]}
      arrangement={arrangement}
      onArrangementChange={vi.fn()}
      onGiftsChange={vi.fn()}
      onPeopleChange={vi.fn()}
    />
  );
}

describe("editing a shared gift from the workspace", () => {
  it("opens with the gift's people and keeps them on save", async () => {
    vi.mocked(giftsService.update).mockResolvedValue(sharedGift);
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Board game/ }));

    const toPicker = screen.getByRole("combobox", { name: "To (Recipients)" });
    const fromPicker = screen.getByRole("combobox", { name: "From (Givers)" });
    expect(within(toPicker.parentElement!).getByRole("button", { name: "Remove Alex" })).toBeTruthy();
    expect(within(toPicker.parentElement!).getByRole("button", { name: "Remove Sam" })).toBeTruthy();
    expect(within(fromPicker.parentElement!).getByRole("button", { name: "Remove Priya" })).toBeTruthy();

    fireEvent.click(toPicker);
    fireEvent.click(screen.getByRole("option", { name: "Priya" }));

    await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
    expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { recipient_ids: [7, 8, 9] });
  });
});
