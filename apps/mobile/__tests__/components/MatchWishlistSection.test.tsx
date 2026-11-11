import { fireEvent, render, screen } from "@testing-library/react-native";
import type { WishlistItem } from "@niftygifty/types";
import { MatchWishlistSection, type MatchNudge } from "@/components/MatchWishlistSection";

function item(id: number, name: string): WishlistItem {
  return {
    id,
    name,
    exchange_participant_id: 2,
    description: null,
    link: null,
    price: null,
    photo_url: null,
    has_photo: false,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
}

function nudge(overrides: Partial<MatchNudge> = {}): MatchNudge {
  return { canNudge: true, nudgeMatch: jest.fn(), nudging: false, nudgeSent: false, nudgeError: null, ...overrides };
}

describe("MatchWishlistSection", () => {
  it("lists your match's ideas in their order", () => {
    render(<MatchWishlistSection matchName="Ana" items={[item(1, "Mixer bowl"), item(2, "Wool socks")]} nudge={nudge()} />);

    expect(screen.getByText("Ana's Wishlist")).toBeTruthy();
    expect(screen.getByText("2 items to choose from")).toBeTruthy();
    expect(screen.getByLabelText("Rank 1")).toBeTruthy();
    expect(screen.getByText("Mixer bowl")).toBeTruthy();
    expect(screen.getByLabelText("Rank 2")).toBeTruthy();
    expect(screen.getByLabelText("Ask for more ideas")).toBeTruthy();
    expect(screen.queryByText("No ideas yet")).toBeNull();
  });

  it("asks an empty-handed match for ideas without saying who asked", () => {
    const ask = nudge();
    render(<MatchWishlistSection matchName="Ana" items={[]} nudge={ask} />);

    expect(screen.getByText("No ideas yet")).toBeTruthy();
    expect(screen.getByText("We'll email them. They won't know it was you.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Ask for ideas"));
    expect(ask.nudgeMatch).toHaveBeenCalledTimes(1);
  });

  it("says the request is on its way once it's sent", () => {
    render(<MatchWishlistSection matchName="Ana" items={[]} nudge={nudge({ nudgeSent: true })} />);

    expect(screen.getByLabelText("Request sent")).toBeTruthy();
    expect(screen.getByText("We'll email you when they add one.")).toBeTruthy();
  });

  it("shows why a request didn't go through", () => {
    render(
      <MatchWishlistSection
        matchName="Ana"
        items={[]}
        nudge={nudge({ nudgeError: "Your anonymous request was already sent in the last 24 hours" })}
      />
    );

    expect(screen.getByText("Your anonymous request was already sent in the last 24 hours")).toBeTruthy();
  });

  it("only says to check back when the match can't be asked", () => {
    render(<MatchWishlistSection matchName="Ana" items={[]} nudge={nudge({ canNudge: false })} />);

    expect(screen.getByText("Ana hasn't added anything to their wishlist. Check back later.")).toBeTruthy();
    expect(screen.queryByLabelText("Ask for ideas")).toBeNull();
  });

  it("says a demo request is simulated", () => {
    render(<MatchWishlistSection matchName="Ana" items={[]} nudge={nudge({ nudgeSent: true })} demo />);

    expect(screen.getByLabelText("Request simulated")).toBeTruthy();
    expect(screen.getByText("This demo simulates the request. No email is sent.")).toBeTruthy();
  });
});
