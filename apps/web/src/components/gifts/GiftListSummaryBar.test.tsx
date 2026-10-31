import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GiftListSummaryBar } from "./GiftListSummaryBar";

describe("the recipients card", () => {
  it("doesn't say Ready on an empty list", () => {
    render(<GiftListSummaryBar gifts={[]} filteredGifts={[]} statuses={[]} holidayDate={null} hasActiveFilters={false} />);

    expect(screen.queryByText("Ready")).toBeNull();
    expect(screen.queryByText("All gifts assigned")).toBeNull();
    expect(screen.getByText("Nobody yet")).toBeTruthy();
  });
});
