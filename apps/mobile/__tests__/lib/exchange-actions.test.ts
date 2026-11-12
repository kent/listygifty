import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ExchangeNotification } from "@niftygifty/types";
import {
  useExchangeDetailController,
  useExchangeInviteController,
  useExchangeMatchController,
  useExchangeParticipantController,
} from "@/lib/controllers/exchanges";

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockNudge = jest.fn();
const mockCreateRequest = jest.fn();
const mockApprove = jest.fn();
const mockDeny = jest.fn();
let mockData: unknown;
let mockList: unknown[] = [];
const mockSetError = jest.fn();
const mockSetData = jest.fn();
const mockSetList = jest.fn();
const mockReloadList = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: "32", participantId: "3", token: "invite" }) }));
jest.mock("@/lib/controllers/use-screen-activity", () => ({ useScreenActivity: () => () => () => true }));
// List resources (exclusions, notifications) get mockList. The rest get mockData.
jest.mock("@/lib/controllers/use-focus-resource", () => ({
  useFocusResource: ({ initialValue }: { initialValue: unknown }) => Array.isArray(initialValue)
    ? { data: mockList, loading: false, error: null, setError: mockSetError, setData: mockSetList, reload: mockReloadList, refresh: jest.fn() }
    : { data: mockData, loading: false, error: null, setError: mockSetError, setData: mockSetData, reload: jest.fn(), refresh: jest.fn() },
}));
jest.mock("@/lib/use-api", () => ({ useServices: () => ({
  exchangeInvites: { accept: mockAccept, decline: mockDecline },
  giftExchanges: { nudgeMatch: mockNudge }, wishlistItems: {}, exchangeParticipants: {}, exchangeNotifications: {},
  wishlistAccessRequests: { create: mockCreateRequest, approve: mockApprove, deny: mockDeny },
}) }));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); mockList = []; mockData = { exchange: { id: 32 }, participant: { status: "invited" } }; });

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
  await act(async () => result.current.nudge.nudgeMatch());
  expect(result.current.nudge.nudgeError).toContain("24 hours");
  expect(result.current.nudge.nudgeSent).toBe(false);
  mockNudge.mockResolvedValue(undefined);
  await act(async () => result.current.nudge.nudgeMatch());
  await act(async () => result.current.nudge.nudgeMatch());
  expect(mockNudge).toHaveBeenCalledTimes(2);
  expect(mockNudge).toHaveBeenLastCalledWith(32);
  expect(result.current.nudge.nudgeSent).toBe(true);
});

it("asks your match for ideas from the exchange screen", async () => {
  mockData = { id: 32, status: "active", is_owner: false, capabilities: { nudge_match: true }, exchange_participants: [] };
  mockNudge.mockResolvedValue(undefined);
  const { result } = renderHook(useExchangeDetailController);
  expect(result.current.matchNudge.canNudge).toBe(true);
  await act(async () => result.current.matchNudge.nudgeMatch());
  expect(mockNudge).toHaveBeenCalledWith(32);
  expect(result.current.matchNudge.nudgeSent).toBe(true);
});

it("won't ask a match who deleted their account", async () => {
  mockData = { id: 32, status: "active", is_owner: false, capabilities: { nudge_match: false }, exchange_participants: [] };
  const { result } = renderHook(useExchangeDetailController);
  expect(result.current.matchNudge.canNudge).toBe(false);
  await act(async () => result.current.matchNudge.nudgeMatch());
  expect(mockNudge).not.toHaveBeenCalled();
});

function wishlistRequest(status: "pending" | "approved" | "denied"): ExchangeNotification {
  const timestamps = { created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" };
  return {
    ...timestamps, id: 51, gift_exchange_id: 32, kind: "wishlist_access_requested", message: "Someone has requested to view your wishlist.",
    wishlist_item_id: null, read_at: null,
    wishlist_access_request: {
      ...timestamps, id: 141, gift_exchange_id: 32, status, decided_at: null,
      requested_participant_id: 2, requested_name: "Ana",
    },
  };
}

describe("wishlist requests on the exchange screen", () => {
  beforeEach(() => {
    mockData = { id: 32, status: "active", is_owner: false, capabilities: { nudge_match: false }, my_participant: { id: 2 }, exchange_participants: [] };
  });

  it("lists only the ones still waiting on you", () => {
    const answered = { ...wishlistRequest("approved"), id: 52 };
    const notice = { ...wishlistRequest("pending"), id: 53, kind: "wishlist_item_added" as const };
    mockList = [wishlistRequest("pending"), answered, notice];
    const { result } = renderHook(useExchangeDetailController);
    expect(result.current.wishlistRequests.map((item) => item.id)).toEqual([51]);
  });

  it("says yes and records the answer", async () => {
    const pending = wishlistRequest("pending");
    mockList = [pending];
    mockApprove.mockResolvedValue(wishlistRequest("approved").wishlist_access_request);
    const { result } = renderHook(useExchangeDetailController);
    await act(async () => result.current.answerWishlistRequest(pending, true));
    expect(mockApprove).toHaveBeenCalledWith(32, 141);
    expect(mockDeny).not.toHaveBeenCalled();
    const update = mockSetList.mock.calls[0][0] as (current: ExchangeNotification[]) => ExchangeNotification[];
    expect(update([pending])[0].wishlist_access_request?.status).toBe("approved");
    expect(result.current.answeringRequestId).toBeNull();
  });

  it("reloads when an answer fails, since it may have been given elsewhere", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const pending = wishlistRequest("pending");
    mockList = [pending];
    mockDeny.mockRejectedValue(Object.assign(new Error("You already answered this request"), { status: 422 }));
    const { result } = renderHook(useExchangeDetailController);
    await act(async () => result.current.answerWishlistRequest(pending, false));
    expect(mockDeny).toHaveBeenCalledWith(32, 141);
    expect(Alert.alert).toHaveBeenCalledWith("Couldn't Answer", expect.stringContaining("already answered"));
    expect(mockReloadList).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("opens other people, and your own name goes to your wishlist", () => {
    const { result } = renderHook(useExchangeDetailController);
    act(() => result.current.goToParticipant({ id: 3 } as never));
    act(() => result.current.goToParticipant({ id: 2 } as never));
    expect(mockRouter.push).toHaveBeenNthCalledWith(1, "/(tabs)/exchanges/32/participants/3");
    expect(mockRouter.push).toHaveBeenNthCalledWith(2, "/(tabs)/exchanges/32/my-wishlist");
  });
});

describe("someone else in the exchange", () => {
  function opened(access: string) {
    return {
      exchange: { id: 32, status: "active", capabilities: { nudge_match: true }, my_participant: { id: 2 } },
      participant: { id: 3, display_name: "Bea", wishlist_access: access },
    };
  }

  it("can be asked for their wishlist, once", async () => {
    mockData = opened("none");
    mockCreateRequest.mockResolvedValue({ id: 141, status: "pending" });
    const { result } = renderHook(useExchangeParticipantController);
    expect(result.current.access).toBe("none");
    await act(async () => result.current.askForWishlist());
    expect(mockCreateRequest).toHaveBeenCalledWith(32, 3);
    const update = mockSetData.mock.calls[0][0] as (current: ReturnType<typeof opened>) => ReturnType<typeof opened>;
    expect(update(opened("none")).participant.wishlist_access).toBe("pending");
  });

  it("shows why a request didn't go through", async () => {
    mockData = opened("none");
    mockCreateRequest.mockRejectedValue(Object.assign(new Error("They'd rather keep their wishlist private"), { status: 422 }));
    const { result } = renderHook(useExchangeParticipantController);
    await act(async () => result.current.askForWishlist());
    expect(result.current.askError).toBe("They'd rather keep their wishlist private");
    expect(result.current.asking).toBe(false);
  });

  it.each(["match", "approved", "pending", "denied", "unavailable"])("isn't asked when access is %s", async (access) => {
    mockData = opened(access);
    const { result } = renderHook(useExchangeParticipantController);
    await act(async () => result.current.askForWishlist());
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  it("is you when it's your own place", () => {
    mockData = { ...opened("none"), participant: { id: 2, display_name: "Ana" } };
    const { result } = renderHook(useExchangeParticipantController);
    expect(result.current.access).toBe("own");
  });
});
