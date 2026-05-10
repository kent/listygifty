import { Platform, TextStyle, ViewStyle } from "react-native";

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLarge: 16,
  subtitle: 18,
  title: 20,
  headline: 24,
  display: 32,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

export const lineHeight = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const typography = {
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: fontSize.headline,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.semibold,
  },
  bodyLarge: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  buttonLarge: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.semibold,
  },
  button: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  small: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.regular,
  },
  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.3,
  },
} as const satisfies Record<string, TextStyle>;

const shadowFactory = (elevation: number, opacity: number, radius: number, offsetY: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
    default: {},
  })!;

export const shadow = {
  none: {} as ViewStyle,
  sm: shadowFactory(2, 0.06, 4, 1),
  md: shadowFactory(4, 0.08, 8, 2),
  lg: shadowFactory(8, 0.12, 16, 4),
  xl: shadowFactory(12, 0.18, 24, 8),
} as const;

export const animation = {
  pressScale: 0.97,
  pressDuration: 90,
  fadeDuration: 200,
} as const;

export const layout = {
  minTouchTarget: 44,
  screenPaddingHorizontal: spacing.lg,
  cardPadding: spacing.lg,
  fabSize: 56,
  fabBottomOffset: 24,
} as const;
