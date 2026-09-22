import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useExchangeInviteController, useExchangeMatchController } from "@/lib/controllers/exchanges";

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockNudge = jest.fn();
let mockData: unknown;
const mockSetError = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: "32", token: "invite" }) }));
jest.mock("@/lib/controllers/use-screen-activity", () => ({ useScreenActivity: () => () => () => true }));
jest.mock("@/lib/controllers/use-focus-resource", () => ({ useFocusResource: () => ({ data: mockData, loading: false, error: null, setError: mockSetError, reload: jest.fn() }) }));
jest.mock("@/lib/use-api", () => ({ useServices: () => ({
  exchangeInvites: { accept: mockAccept, decline: mockDecline },
  giftExchanges: { nudgeMatch: mockNudge }, wishlistItems: {},
}) }));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); mockData = { exchange: { id: 32 }, participant: { status: "invited" } }; });

it("keeps the invitation and a retryable action error after joining fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockAccept.mockRejectedValue(new Error("Network request failed"));
  const { result } = renderHook(useExchangeInviteController);
  await act(async () => result.current.handleAccept());
  expect(result.current.invite).toBe(mockData);
  expect(result.current.error).toBeNull();
  expect(result.current.actionError).toContain("Check your connection");
  expect(mockSetError).not.toHaveBeenCalled();
  mockAccept.mockResolvedValue({ exchange: { id: 32 } });
  await act(async () => result.current.handleAccept());
  expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)/exchanges/32");
  expect(result.current.actionError).toBeNull();
  jest.restoreAllMocks();
});

it("lets the participant cancel declining without changing their invitation", () => {
  const alert = jest.spyOn(Alert, "alert");
  const { result } = renderHook(useExchangeInviteController);
  act(() => result.current.handleDecline());
  expect(alert).toHaveBeenCalledWith("Decline invitation?", expect.any(String), expect.arrayContaining([expect.objectContaining({ style: "cancel" })]));
  expect(mockDecline).not.toHaveBeenCalled();
  alert.mockRestore();
});

it("sends an anonymous wishlist request once and shows delivery errors", async () => {
  mockData = { exchange: { id: 32, capabilities: { nudge_match: true } }, matchWishlist: [] };
  mockNudge.mockRejectedValueOnce(Object.assign(new Error("Your anonymous request was already sent in the last 24 hours"), {status:422}));
  const { result } = renderHook(useExchangeMatchController);
  await act(async () => result.current.nudgeMatch());
  expect(result.current.nudgeError).toContain("24 hours");
  expect(result.current.nudgeSent).toBe(false);
  mockNudge.mockResolvedValue(undefined);
  await act(async () => result.current.nudgeMatch());
  await act(async () => result.current.nudgeMatch());
  expect(mockNudge).toHaveBeenCalledTimes(2);
  expect(mockNudge).toHaveBeenLastCalledWith(32);
  expect(result.current.nudgeSent).toBe(true);
});
