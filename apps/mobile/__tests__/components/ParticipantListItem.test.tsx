import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ExchangeParticipant } from "@niftygifty/types";
import { ParticipantListItem } from "@/components/ParticipantListItem";

function buildParticipant(overrides: Partial<ExchangeParticipant> = {}): ExchangeParticipant {
  return {
    id: overrides.id || 1,
    gift_exchange_id: overrides.gift_exchange_id || 10,
    user_id: overrides.user_id ?? null,
    name: overrides.name || "Alex Parker",
    email: overrides.email || "alex@example.com",
    status: overrides.status || "invited",
    display_name: overrides.display_name || "Alex Parker",
    has_user: overrides.has_user ?? false,
    wishlist_count: overrides.wishlist_count || 0,
    invite_token: overrides.invite_token,
    matched_participant_id: overrides.matched_participant_id ?? null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ParticipantListItem", () => {
  it("renders participant identity", () => {
    render(<ParticipantListItem participant={buildParticipant()} />);

    expect(screen.getByText("Alex Parker")).toBeTruthy();
    expect(screen.getByText("alex@example.com")).toBeTruthy();
  });

  it("omits the email row when the roster response hides it", () => {
    render(<ParticipantListItem participant={buildParticipant({ email: undefined })} />);

    expect(screen.getByText("Alex Parker")).toBeTruthy();
    expect(screen.queryByText("alex@example.com")).toBeNull();
  });

  it("renders wishlist count when requested", () => {
    render(
      <ParticipantListItem
        participant={buildParticipant({ wishlist_count: 3 })}
        showWishlistCount
      />
    );

    expect(screen.getByText("3 items")).toBeTruthy();
  });

  it("calls the share handler when invite sharing is available", () => {
    const onShareInvite = jest.fn();
    render(
      <ParticipantListItem
        participant={buildParticipant({ invite_token: "abc" })}
        onShareInvite={onShareInvite}
      />
    );

    fireEvent.press(screen.getByText("Share"));
    expect(onShareInvite).toHaveBeenCalledTimes(1);
  });
});
