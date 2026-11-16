import { act, renderHook } from "@testing-library/react-native";
import type { WishlistItem } from "@niftygifty/types";
import { useWishlistMarks } from "@/lib/controllers/wishlist-marks";

const mockClaim = jest.fn();
const mockMarkPurchased = jest.fn();
const mockUnclaim = jest.fn();

jest.mock("@/lib/use-api", () => ({
  useServices: () => ({
    wishlistItems: { claim: mockClaim, markPurchased: mockMarkPurchased, unclaim: mockUnclaim },
  }),
}));
jest.mock("@/lib/haptics", () => ({ haptics: { success: jest.fn() } }));

const bowl = { id: 41, name: "Mixer bowl", exchange_participant_id: 2, is_available: true, claimed_quantity: 0, my_claim: null } as WishlistItem;
const socks = { id: 40, name: "Wool socks", exchange_participant_id: 2, is_available: true, claimed_quantity: 0, my_claim: null } as WishlistItem;
const reserved = { ...bowl, is_available: false, claimed_quantity: 1, my_claim: { status: "reserved" } } as WishlistItem;
const bought = { ...bowl, is_available: false, claimed_quantity: 1, my_claim: { status: "purchased" } } as WishlistItem;

function marks(items: WishlistItem[]) {
  return renderHook(() => useWishlistMarks(7, items)).result;
}

beforeEach(() => {
  mockClaim.mockReset();
  mockMarkPurchased.mockReset();
  mockUnclaim.mockReset();
});

describe("marking what you're getting", () => {
  it("reserving swaps in the item the API answers with", async () => {
    mockClaim.mockResolvedValue(reserved);
    const result = marks([socks, bowl]);

    await act(async () => {
      await result.current.reserve(bowl);
    });

    expect(mockClaim).toHaveBeenCalledWith(7, 2, 41, false);
    expect(result.current.items).toEqual([socks, reserved]);
    expect(result.current.busy).toBe(false);
  });

  it("an open item is bought in one step", async () => {
    mockClaim.mockResolvedValue(bought);
    const result = marks([socks, bowl]);

    await act(async () => {
      await result.current.buy(bowl);
    });

    expect(mockClaim).toHaveBeenCalledWith(7, 2, 41, true);
    expect(result.current.items[1].my_claim).toEqual({ status: "purchased" });
  });

  it("a reserved item is turned into a bought one", async () => {
    mockMarkPurchased.mockResolvedValue(bought);
    const result = marks([socks, reserved]);

    await act(async () => {
      await result.current.buy(reserved);
    });

    expect(mockMarkPurchased).toHaveBeenCalledWith(7, 2, 41);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(result.current.items[1]).toEqual(bought);
  });

  it("undoes a mark", async () => {
    mockUnclaim.mockResolvedValue(bowl);
    const result = marks([socks, bought]);

    await act(async () => {
      await result.current.undo(bought);
    });

    expect(mockUnclaim).toHaveBeenCalledWith(7, 2, 41);
    expect(result.current.items[1]).toEqual(bowl);
  });

  it("when someone got there first, says so and shows the item as taken", async () => {
    mockClaim.mockRejectedValue(Object.assign(new Error("Someone is already getting this one."), { status: 409 }));
    const result = marks([socks, bowl]);

    await act(async () => {
      await result.current.reserve(bowl);
    });

    expect(result.current.error).toBe("Someone is already getting this one. Pick something else?");
    expect(result.current.items[1]).toMatchObject({ is_available: false, my_claim: null });
  });

  it("another failure leaves the list alone and says what went wrong", async () => {
    mockClaim.mockRejectedValue(new Error("The list changed"));
    const result = marks([socks, bowl]);

    await act(async () => {
      await result.current.reserve(bowl);
    });

    expect(result.current.error).toBe("The list changed");
    expect(result.current.items).toEqual([socks, bowl]);
  });

  it("can't mark without an exchange, or when the API is too old to say what's taken", () => {
    expect(renderHook(() => useWishlistMarks(undefined, [bowl])).result.current.canMark).toBe(false);
    expect(marks([{ id: 1, name: "Old", exchange_participant_id: 2 } as WishlistItem]).current.canMark).toBe(false);
    expect(marks([bowl]).current.canMark).toBe(true);
  });
});
