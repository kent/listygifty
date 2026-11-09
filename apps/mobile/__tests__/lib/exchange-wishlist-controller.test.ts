import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { WishlistItem } from "@niftygifty/types";
import { useExchangeWishlistController } from "@/lib/controllers/exchanges";

const mockGetExchange = jest.fn();
const mockGetItems = jest.fn();
const mockReorder = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "7" }), useRouter: () => mockRouter }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("@/lib/use-api", () => ({
  useServices: () => ({
    giftExchanges: { getById: mockGetExchange },
    wishlistItems: { getAll: mockGetItems, reorder: mockReorder, delete: jest.fn() },
  }),
}));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));

function item(id: number, name: string): WishlistItem {
  return { id, name, exchange_participant_id: 2 } as WishlistItem;
}

const socks = item(40, "Wool socks");
const bowl = item(41, "Mixer bowl");

beforeEach(() => {
  mockGetExchange.mockReset().mockResolvedValue({ id: 7, my_participant: { id: 2 } });
  mockGetItems.mockReset().mockResolvedValue([socks, bowl]);
  mockReorder.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("putting an exchange wishlist in order", () => {
  it("moving an item calls reorder with the new order", async () => {
    mockReorder.mockResolvedValue([bowl, socks]);
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});

    await act(async () => {
      await result.current.handleMoveItem(1, -1);
    });

    expect(mockReorder).toHaveBeenCalledWith(7, 2, [41, 40]);
    expect(result.current.items.map((entry) => entry.name)).toEqual(["Mixer bowl", "Wool socks"]);
  });

  it("a failed reorder reloads", async () => {
    mockReorder.mockRejectedValue(new Error("stale"));
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});
    expect(mockGetItems).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleMoveItem(1, -1);
    });

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Couldn't save the new order");
    expect(mockGetItems).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((entry) => entry.name)).toEqual(["Wool socks", "Mixer bowl"]);
  });

  it("ignores a move off the end of the list", async () => {
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});

    await act(async () => {
      await result.current.handleMoveItem(0, -1);
    });

    expect(mockReorder).not.toHaveBeenCalled();
  });
});
