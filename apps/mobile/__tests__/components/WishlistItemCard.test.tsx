import { fireEvent, render, screen } from "@testing-library/react-native";
import type { WishlistItem } from "@niftygifty/types";
import { WishlistItemCard } from "@/components/WishlistItemCard";

const socks: WishlistItem = {
  id: 40,
  exchange_participant_id: 2,
  name: "Wool socks",
  description: null,
  link: null,
  price: "40.0",
  photo_url: null,
  has_photo: false,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

describe("WishlistItemCard order", () => {
  it("shows the rank and moves the item", () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();

    render(
      <WishlistItemCard item={socks} editable rank={2} total={3} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    );

    expect(screen.getByLabelText("Rank 2")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Move Wool socks up"));
    fireEvent.press(screen.getByLabelText("Move Wool socks down"));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it("can't move the first item up or the last item down", () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();

    const { rerender } = render(
      <WishlistItemCard item={socks} editable rank={1} total={2} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    );
    fireEvent.press(screen.getByLabelText("Move Wool socks up"));
    expect(onMoveUp).not.toHaveBeenCalled();

    rerender(<WishlistItemCard item={socks} editable rank={2} total={2} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);
    fireEvent.press(screen.getByLabelText("Move Wool socks down"));
    expect(onMoveDown).not.toHaveBeenCalled();
  });

  it("card hides move buttons when not editable", () => {
    render(<WishlistItemCard item={socks} rank={1} total={2} onMoveUp={jest.fn()} onMoveDown={jest.fn()} />);

    expect(screen.getByLabelText("Rank 1")).toBeTruthy();
    expect(screen.queryByLabelText("Move Wool socks up")).toBeNull();
  });

  it("shows the price range the API sends", () => {
    render(<WishlistItemCard item={{ ...socks, price_display: "$20.00 - $40.00" }} />);

    expect(screen.getByText("$20.00 - $40.00")).toBeTruthy();
  });
});
