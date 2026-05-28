import * as Notifications from "expo-notifications";
import { scheduleExchangeReminder } from "@/lib/notifications";

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
