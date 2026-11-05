import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { GiftListSummaryBar } from "./GiftListSummaryBar";

describe("the recipients card", () => {
  it("doesn't say Ready on an empty list", () => {
    render(<GiftListSummaryBar gifts={[]} statuses={[]} holidayDate={null} />);

    expect(screen.queryByText("Ready")).toBeNull();
    expect(screen.queryByText("All gifts assigned")).toBeNull();
    expect(screen.getByText("Nobody yet")).toBeTruthy();
  });
});

describe("the progress card", () => {
  const statuses = [
    { id: 1, name: "Idea", position: 1 },
    { id: 2, name: "Purchased", position: 2 },
    { id: 3, name: "Delivered", position: 4 },
    { id: 4, name: "Done", position: 5 },
  ] as GiftStatus[];
  const gift = (id: number, statusId: number) =>
    ({ id, gift_status_id: statusId, recipients: [], cost: null }) as unknown as Gift;
  const renderWith = (gifts: Gift[], withStatuses = statuses) =>
    render(<GiftListSummaryBar gifts={gifts} statuses={withStatuses} holidayDate={null} />);

  it("counts a purchased gift as progress", () => {
    renderWith([gift(1, 2), gift(2, 1)]);
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("50% complete")).toBeTruthy();
  });

  it("counts every step after Purchased too", () => {
    renderWith([gift(1, 3), gift(2, 4), gift(3, 1)]);
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("falls back to the last step when a workspace has no Purchased status", () => {
    const custom = [{ id: 1, name: "Maybe", position: 1 }, { id: 2, name: "Sorted", position: 2 }] as GiftStatus[];
    renderWith([gift(1, 2), gift(2, 1)], custom);
    expect(screen.getByText("1/2")).toBeTruthy();
  });
});
