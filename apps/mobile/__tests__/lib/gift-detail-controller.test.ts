import { act, renderHook } from "@testing-library/react-native";
import type { Gift } from "@niftygifty/types";
import { useGiftDetailController } from "@/lib/controllers/lists";

let mockGiftId = "1";
const mockGetGift = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ giftId: mockGiftId }), usePathname: () => `/gift/${mockGiftId}`, useRouter: () => mockRouter }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("@/lib/use-api", () => ({
  useServices: () => ({ gifts: { getById: mockGetGift }, giftStatuses: { getAll: async () => [] } }),
}));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn() }));

function gift(id: number, name: string): Gift {
  return { id, name, description: null, link: null, cost: null, gift_status_id: 1, recipients: [], givers: [] } as unknown as Gift;
}

function deferred() {
  let resolve!: (value: Gift) => void;
  const promise = new Promise<Gift>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("gift editor loading", () => {
  beforeEach(() => { mockGiftId = "1"; mockGetGift.mockReset(); });

  it("does not replace the current gift form with a previous route's response", async () => {
    const old = deferred();
    mockGetGift.mockReturnValueOnce(old.promise).mockResolvedValue(gift(2, "Current"));
    const { result, rerender } = renderHook(useGiftDetailController);
    mockGiftId = "2";
    rerender({});
    await act(async () => {});
    expect(result.current.form.name).toBe("Current");
    await act(async () => old.resolve(gift(1, "Obsolete")));
    expect(result.current.gift?.id).toBe(2);
    expect(result.current.form.name).toBe("Current");
  });

  it("preserves unsaved edits when the same gift is refreshed", async () => {
    mockGetGift.mockImplementation(async () => gift(1, "Original"));
    const { result } = renderHook(useGiftDetailController);
    await act(async () => {});
    act(() => result.current.updateField("name", "Unsaved"));
    await act(async () => { await result.current.retryLoad(); });
    expect(result.current.form.name).toBe("Unsaved");
    expect(result.current.hasChanges).toBe(true);
  });
});
