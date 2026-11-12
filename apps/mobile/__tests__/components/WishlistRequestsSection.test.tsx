import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ExchangeNotification } from "@niftygifty/types";
import { WishlistRequestsSection } from "@/components/WishlistRequestsSection";

const timestamps = { created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" };

function request(id: number, name: string): ExchangeNotification {
  return {
    ...timestamps,
    id,
    gift_exchange_id: 7,
    kind: "wishlist_access_requested",
    message: `${name} asked to see your wishlist.`,
    wishlist_item_id: null,
    read_at: null,
    wishlist_access_request: {
      ...timestamps,
      id: id + 100,
      gift_exchange_id: 7,
      status: "pending",
      decided_at: null,
      requester_participant_id: id,
      requester_name: name,
      requested_participant_id: 2,
      requested_name: "Ana",
    },
  };
}

describe("WishlistRequestsSection", () => {
  it("lets you say yes or no to each person who asked", () => {
    const onAnswer = jest.fn();
    const kent = request(1, "Kent");
    render(<WishlistRequestsSection requests={[kent, request(3, "Bea")]} answeringRequestId={null} onAnswer={onAnswer} />);

    expect(screen.getByText("Kent asked to see your wishlist.")).toBeTruthy();
    expect(screen.getByText("Bea asked to see your wishlist.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Let Kent see your wishlist"));
    fireEvent.press(screen.getByLabelText("Keep your wishlist private from Bea"));

    expect(onAnswer).toHaveBeenNthCalledWith(1, kent, true);
    expect(onAnswer).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 3 }), false);
  });

  it("holds every answer while one is saving", () => {
    const onAnswer = jest.fn();
    render(<WishlistRequestsSection requests={[request(1, "Kent"), request(3, "Bea")]} answeringRequestId={101} onAnswer={onAnswer} />);

    fireEvent.press(screen.getByLabelText("Keep your wishlist private from Bea"));

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows nothing when nobody is waiting", () => {
    render(<WishlistRequestsSection requests={[]} answeringRequestId={null} onAnswer={jest.fn()} />);

    expect(screen.queryByTestId("wishlist-requests")).toBeNull();
  });
});
