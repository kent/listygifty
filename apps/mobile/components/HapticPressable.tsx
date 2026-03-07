import type { ReactNode } from "react";
import {
  Pressable,
  type Insets,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptics, type HapticIntent } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";

type PressableStyle =
  | StyleProp<ViewStyle>
  | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);

interface HapticPressableProps
  extends Omit<PressableProps, "android_ripple" | "children" | "style"> {
  androidRippleColor?: string;
  children: ReactNode;
  haptic?: HapticIntent | "none";
  hitSlop?: Insets | number;
  pressedOpacity?: number;
  style?: PressableStyle;
}

export function HapticPressable({
  androidRippleColor,
  children,
  disabled,
  haptic = "selection",
  hitSlop = 8,
  onPress,
  pressedOpacity = 0.72,
  style,
  ...props
}: HapticPressableProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      {...props}
      android_ripple={{
        color: androidRippleColor ?? colors.surfaceSecondary,
      }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={(event) => {
        if (!disabled && haptic !== "none") {
          void haptics.trigger(haptic);
        }

        onPress?.(event);
      }}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        !disabled && state.pressed ? { opacity: pressedOpacity } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
