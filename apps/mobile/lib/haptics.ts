import { Platform } from "react-native";
import * as ExpoHaptics from "expo-haptics";

export type HapticIntent =
  | "selection"
  | "soft"
  | "medium"
  | "success"
  | "warning"
  | "error";

async function runHaptic(intent: HapticIntent): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    switch (intent) {
      case "selection":
        await ExpoHaptics.selectionAsync();
        return;
      case "soft":
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        return;
      case "medium":
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        return;
      case "success":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
        return;
      case "warning":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
        return;
      case "error":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Haptics are optional and should never break an interaction.
  }
}

export const haptics = {
  trigger: runHaptic,
  selection: () => runHaptic("selection"),
  soft: () => runHaptic("soft"),
  medium: () => runHaptic("medium"),
  success: () => runHaptic("success"),
  warning: () => runHaptic("warning"),
  error: () => runHaptic("error"),
};
