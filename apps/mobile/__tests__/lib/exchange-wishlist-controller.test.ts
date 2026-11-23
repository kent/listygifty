import { act, renderHook } from "@testing-library/react-native";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { WishlistItem } from "@niftygifty/types";
import { useExchangeWishlistController } from "@/lib/controllers/exchanges";

const mockGetExchange = jest.fn();
const mockGetItems = jest.fn();
const mockReorder = jest.fn();
const mockChooseWishlist = jest.fn();
const mockGetMine = jest.fn();
const mockCreateWishlist = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "7" }), useRouter: () => mockRouter }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("@/lib/use-api", () => ({
  useServices: () => ({
    giftExchanges: { getById: mockGetExchange },
    wishlistItems: { getAll: mockGetItems, reorder: mockReorder, delete: jest.fn() },
    exchangeParticipants: { chooseWishlist: mockChooseWishlist },
    wishlists: { getMine: mockGetMine, create: mockCreateWishlist },
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

describe("choosing which wishlist an exchange uses", () => {
  const current = { id: 9, name: "My Wishlist", item_count: 2 };
  let pick: (label: string) => void;

  beforeEach(() => {
    Platform.OS = "ios";
    mockGetExchange.mockResolvedValue({ id: 7, name: "Family Christmas", my_participant: { id: 2, wishlist: current } });
    mockGetMine.mockReset().mockResolvedValue([
      { id: 9, name: "My Wishlist", is_owner: true },
      { id: 12, name: "Birthday", is_owner: true },
    ]);
    mockChooseWishlist.mockReset().mockResolvedValue({});
    mockCreateWishlist.mockReset();
    jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((options, callback) => {
      pick = (label) => callback(options.options.indexOf(label));
    });
  });

  it("offers your lists and a new one, then switches", async () => {
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});
    expect(result.current.currentWishlist).toEqual(current);

    await act(async () => {
      await result.current.handleChangeWishlist();
    });
    const options = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mock.calls[0][0].options;
    expect(options).toEqual(["✓ My Wishlist", "Birthday", "New wishlist…", "Cancel"]);

    await act(async () => {
      pick("Birthday");
    });

    expect(mockChooseWishlist).toHaveBeenCalledWith(7, 2, 12);
    expect(mockGetExchange).toHaveBeenCalledTimes(2);
  });

  it("picking the list already in use does nothing", async () => {
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});

    await act(async () => {
      await result.current.handleChangeWishlist();
    });
    await act(async () => {
      pick("✓ My Wishlist");
    });

    expect(mockChooseWishlist).not.toHaveBeenCalled();
  });

  it("starts a new list named after the exchange", async () => {
    mockCreateWishlist.mockResolvedValue({ id: 15, name: "Family Christmas", is_owner: true });
    const prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => undefined);
    const { result } = renderHook(useExchangeWishlistController);
    await act(async () => {});

    await act(async () => {
      await result.current.handleChangeWishlist();
    });
    await act(async () => {
      pick("New wishlist…");
    });
    const [, , buttons, , defaultValue] = prompt.mock.calls[0];
    expect(defaultValue).toBe("Family Christmas");

    await act(async () => {
      (buttons as { text: string; onPress?: (value?: string) => void }[])
        .find((button) => button.text === "Make and use it")
        ?.onPress?.("Family Christmas");
    });

    expect(mockCreateWishlist).toHaveBeenCalledWith("Family Christmas");
    expect(mockChooseWishlist).toHaveBeenCalledWith(7, 2, 15);
  });
});
