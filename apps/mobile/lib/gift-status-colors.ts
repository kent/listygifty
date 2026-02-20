import type { Colors } from "@/lib/theme";

interface StatusColor {
  backgroundColor: string;
  textColor: string;
}

export function getGiftStatusColors(statusName: string, colors: Colors, isDark: boolean): StatusColor {
  const normalizedName = statusName.toLowerCase();

  if (normalizedName.includes("idea") || normalizedName.includes("thinking")) {
    return {
      backgroundColor: isDark ? "#1e1b4b" : "#f3e8ff",
      textColor: isDark ? "#a78bfa" : "#7c3aed",
    };
  }

  if (normalizedName.includes("bought") || normalizedName.includes("purchased")) {
    return {
      backgroundColor: isDark ? "#14532d" : "#dcfce7",
      textColor: isDark ? "#86efac" : "#15803d",
    };
  }

  if (normalizedName.includes("wrapped")) {
    return {
      backgroundColor: isDark ? "#164e63" : "#cffafe",
      textColor: isDark ? "#67e8f9" : "#0e7490",
    };
  }

  if (normalizedName.includes("given") || normalizedName.includes("delivered")) {
    return {
      backgroundColor: isDark ? "#065f46" : "#d1fae5",
      textColor: isDark ? "#6ee7b7" : "#059669",
    };
  }

  return {
    backgroundColor: colors.surfaceSecondary,
    textColor: colors.textTertiary,
  };
}
