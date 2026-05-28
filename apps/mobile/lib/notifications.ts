import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import type { GiftExchange, Holiday, Person } from "@niftygifty/types";
import {
  getBirthdayReminderSchedule,
  getExchangeReminderDate,
  getGiftListReminderDate,
  getMilestoneReminderSchedule,
} from "@/lib/models";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token.
 * Returns null if running in simulator or permission denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  // Get the Expo push token
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    return token.data;
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}

/**
 * Set up Android notification channel (required for Android)
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8b5cf6",
    });
  }
}

/**
 * Handle notification response (when user taps a notification)
 */
export function setupNotificationHandlers(): () => void {
  // Handle notification tap
  const subscription = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as unknown as NotificationData;

    // Navigate based on notification type
    switch (data.type) {
      case "exchange_invite":
        if (data.token) {
          router.push(`/join/exchange/${data.token}`);
        }
        break;

      case "match_revealed":
        if (data.exchangeId) {
          router.push(`/(tabs)/exchanges/${data.exchangeId}/my-match`);
        }
        break;

      case "wishlist_updated":
        if (data.exchangeId) {
          router.push(`/(tabs)/exchanges/${data.exchangeId}/my-match`);
        }
        break;

      case "exchange_reminder":
        if (data.exchangeId) {
          router.push(`/(tabs)/exchanges/${data.exchangeId}`);
        }
        break;

      case "gift_list_reminder":
        if (data.holidayId) {
          router.push(`/(tabs)/lists/${data.holidayId}`);
        }
        break;

      case "birthday_reminder":
        router.push("/(tabs)/people");
        break;

      case "milestone_reminder":
        router.push("/(tabs)/people");
        break;

      default:
        // Default to exchanges list
        router.push("/(tabs)/exchanges");
    }
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}

/**
 * Get the last notification response (for handling notification that opened the app)
 */
export async function getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

async function requestLocalNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleGiftListReminder(holiday: Holiday): Promise<string | null> {
  const reminderDate = getGiftListReminderDate(holiday);
  if (!reminderDate) {
    return null;
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Gift deadline: ${holiday.name}`,
      body: "Review gift ideas, purchases, and delivery details before the date arrives.",
      data: {
        type: "gift_list_reminder",
        holidayId: holiday.id,
      } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function scheduleExchangeReminder(
  exchange: Pick<GiftExchange, "id" | "name" | "exchange_date" | "status">
): Promise<string | null> {
  const reminderDate = getExchangeReminderDate(exchange);
  if (!reminderDate) {
    return null;
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Gift exchange soon: ${exchange.name}`,
      body: "Review your wishlist, gift plan, and exchange details before the date arrives.",
      data: {
        type: "exchange_reminder",
        exchangeId: exchange.id,
      } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function scheduleBirthdayReminder(
  person: Pick<Person, "id" | "name" | "birthday">
): Promise<string | null> {
  const reminderSchedule = getBirthdayReminderSchedule(person);
  if (!reminderSchedule) {
    return null;
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${person.name}'s birthday`,
      body: "Check gift ideas and plans before the day gets away.",
      data: {
        type: "birthday_reminder",
        personId: person.id,
      } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      day: reminderSchedule.day,
      month: reminderSchedule.monthIndex,
      hour: reminderSchedule.hour,
      minute: reminderSchedule.minute,
    },
  });
}

export async function scheduleMilestoneReminder(
  person: Pick<Person, "id" | "name" | "milestone_label" | "milestone_date">
): Promise<string | null> {
  const reminderSchedule = getMilestoneReminderSchedule(person);
  if (!reminderSchedule) {
    return null;
  }

  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await setupNotificationChannel();

  const milestoneLabel = person.milestone_label || "Milestone";

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${person.name}: ${milestoneLabel}`,
      body: "Review gift ideas and notes before the milestone arrives.",
      data: {
        type: "milestone_reminder",
        personId: person.id,
      } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      day: reminderSchedule.day,
      month: reminderSchedule.monthIndex,
      hour: reminderSchedule.hour,
      minute: reminderSchedule.minute,
    },
  });
}

// Notification types for reference
export interface NotificationData {
  type:
    | "exchange_invite"
    | "match_revealed"
    | "wishlist_updated"
    | "exchange_reminder"
    | "gift_list_reminder"
    | "birthday_reminder"
    | "milestone_reminder";
  token?: string; // For exchange_invite
  exchangeId?: number; // For match_revealed and wishlist_updated
  holidayId?: number; // For gift_list_reminder
  personId?: number; // For birthday_reminder
}
