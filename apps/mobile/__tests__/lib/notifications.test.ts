import * as Notifications from "expo-notifications";
import { notificationTarget, setupNotificationHandlers, scheduleExchangeReminder } from "@/lib/notifications";

describe("notification scheduling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules a privacy-preserving exchange reminder before the exchange date", async () => {
    const reminderYear = new Date().getFullYear() + 1;
    const notificationId = await scheduleExchangeReminder({
      id: 44,
      name: "Family Secret Santa",
      exchange_date: `${reminderYear}-12-25`,
      status: "active",
    });

    expect(notificationId).toBe("notification-id");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Gift exchange soon: Family Secret Santa",
        body: "Review your wishlist, gift plan, and exchange details before the date arrives.",
        data: {
          type: "exchange_reminder",
          exchangeId: 44,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderYear, 11, 24, 9, 0, 0, 0),
      },
    });
  });
});


describe("notification navigation", () => {
  const response = (identifier: string, data: Record<string, unknown>) => ({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { identifier, content: { data } } },
  } as Notifications.NotificationResponse);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
  });

  it("opens a cold-start reminder once and clears it for the next launch", () => {
    const tap = response("cold-start", { type: "gift_list_reminder", holidayId: 12 });
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(tap);
    const navigate = jest.fn();
    const cleanup = setupNotificationHandlers(navigate);
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    listener(tap);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/(tabs)/lists/12");
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("opens live taps and ignores callbacks after cleanup", () => {
    const navigate = jest.fn();
    const cleanup = setupNotificationHandlers(navigate);
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    listener(response("live", { type: "exchange_invite", token: "abc_123" }));
    cleanup();
    listener(response("obsolete", { type: "exchange_reminder", exchangeId: 3 }));
    expect(navigate.mock.calls).toEqual([["/join/exchange/abc_123"]]);
    expect(jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.results[0].value.remove).toHaveBeenCalled();
  });

  it("does not navigate for malformed payloads or unknown actions", () => {
    for (const data of [null, {}, { type: "unknown" }, { type: "exchange_invite", token: "../../auth" },
      { type: "exchange_reminder", exchangeId: -1 }, { type: "gift_list_reminder", holidayId: "12/../3" }]) {
      expect(notificationTarget(data)).toBeNull();
    }
    const navigate = jest.fn();
    const cleanup = setupNotificationHandlers(navigate);
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    listener({ ...response("dismiss", { type: "birthday_reminder" }), actionIdentifier: "dismiss" });
    expect(navigate).not.toHaveBeenCalled();
    cleanup();
  });

  it("routes all supported reminders to their existing screens", () => {
    expect(notificationTarget({ type: "match_revealed", exchangeId: 4 })).toBe("/(tabs)/exchanges/4/my-match");
    expect(notificationTarget({ type: "wishlist_updated", exchangeId: 4 })).toBe("/(tabs)/exchanges/4/my-match");
    expect(notificationTarget({ type: "exchange_reminder", exchangeId: 4 })).toBe("/(tabs)/exchanges/4");
    expect(notificationTarget({ type: "birthday_reminder" })).toBe("/(tabs)/people");
    expect(notificationTarget({ type: "milestone_reminder" })).toBe("/(tabs)/people");
  });
});
