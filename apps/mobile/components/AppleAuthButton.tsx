import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";

type AppleAuthButtonProps = {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
};

function canUseNativeAppleButton(): boolean {
  return Platform.OS === "ios" && Constants.appOwnership !== "expo";
}

export function AppleAuthButton({ onPress, loading, disabled = false }: AppleAuthButtonProps) {
  const isDisabled = disabled || loading;
  const useNativeButton = canUseNativeAppleButton();

  if (useNativeButton && !loading) {
    return (
      <View
        pointerEvents={isDisabled ? "none" : "auto"}
        style={{
          marginBottom: 24,
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          onPress={onPress}
          style={{
            width: "100%",
            height: 50,
          }}
        />
      </View>
    );
  }

  return (
    <HapticPressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      style={{
        backgroundColor: "#111827",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Continue with Apple</Text>
      )}
    </HapticPressable>
  );
}
