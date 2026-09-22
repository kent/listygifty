import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
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

  await setupNotificationChannel();

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
export function notificationTarget(data: unknown): Href | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  const validId = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;

  switch (payload.type) {
    case "exchange_invite":
      return typeof payload.token === "string" && /^[A-Za-z0-9_-]+$/.test(payload.token)
        ? `/join/exchange/${payload.token}` : null;
    case "match_revealed":
    case "wishlist_updated":
      return validId(payload.exchangeId) ? `/(tabs)/exchanges/${payload.exchangeId}/my-match` : null;
    case "exchange_reminder":
      return validId(payload.exchangeId) ? `/(tabs)/exchanges/${payload.exchangeId}` : null;
    case "gift_list_reminder":
      return validId(payload.holidayId) ? `/(tabs)/lists/${payload.holidayId}` : null;
    case "birthday_reminder":
    case "milestone_reminder":
      return "/(tabs)/people";
    default:
      return null;
  }
}

export function setupNotificationHandlers(navigate: (target: Href) => void = router.push): () => void {
  if (Platform.OS === "web") return () => {};
  let active = true;
  const handled = new Set<string>();
  const handleResponse = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const identifier = response.notification.request.identifier;
    if (handled.has(identifier)) return;
    handled.add(identifier);
    const target = notificationTarget(response.notification.request.content.data);
    Notifications.clearLastNotificationResponse();
    if (target) navigate(target);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  handleResponse(Notifications.getLastNotificationResponse());

  return () => {
    active = false;
    subscription.remove();
  };
}

async function requestLocalNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel();
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
