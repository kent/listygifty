import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ExchangeNotification } from "@niftygifty/types";
import { WishlistRequestsSection } from "@/components/WishlistRequestsSection";

const timestamps = { created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" };

function request(id: number): ExchangeNotification {
  return {
    ...timestamps,
    id,
    gift_exchange_id: 7,
    kind: "wishlist_access_requested",
    message: "Someone has requested to view your wishlist.",
    wishlist_item_id: null,
    read_at: null,
    wishlist_access_request: {
      ...timestamps,
      id: id + 100,
      gift_exchange_id: 7,
      status: "pending",
      decided_at: null,
      requested_participant_id: 2,
      requested_name: "Ana",
    },
  };
}

describe("WishlistRequestsSection", () => {
  it("lets you say yes or no to each request without saying who asked", () => {
    const onAnswer = jest.fn();
    const first = request(1);
    const second = request(3);
    render(<WishlistRequestsSection requests={[first, second]} answeringRequestId={null} onAnswer={onAnswer} />);

    expect(screen.getAllByText("Someone has requested to view your wishlist.")).toHaveLength(2);
    fireEvent.press(screen.getAllByLabelText("Let them see your wishlist")[0]);
    fireEvent.press(screen.getAllByLabelText("Keep your wishlist private")[1]);

    expect(onAnswer).toHaveBeenNthCalledWith(1, first, true);
    expect(onAnswer).toHaveBeenNthCalledWith(2, second, false);
  });

  it("holds every answer while one is saving", () => {
    const onAnswer = jest.fn();
    render(<WishlistRequestsSection requests={[request(1), request(3)]} answeringRequestId={101} onAnswer={onAnswer} />);

    fireEvent.press(screen.getAllByLabelText("Keep your wishlist private")[1]);

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows nothing when nobody is waiting", () => {
    render(<WishlistRequestsSection requests={[]} answeringRequestId={null} onAnswer={jest.fn()} />);

    expect(screen.queryByTestId("wishlist-requests")).toBeNull();
  });
});
