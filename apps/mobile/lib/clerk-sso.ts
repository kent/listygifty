import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { Platform } from "react-native";

const SSO_CALLBACK_PATH = "sso-callback";
const APP_SCHEME = "niftygifty";

export function getClerkRedirectUrl(): string {
  // Expo Go cannot handle custom app schemes, so use an exp:// callback there.
  if (Constants.appOwnership === "expo") {
    return AuthSession.makeRedirectUri({
      path: SSO_CALLBACK_PATH,
      preferLocalhost: true,
    });
  }

  return AuthSession.makeRedirectUri({
    scheme: APP_SCHEME,
    path: SSO_CALLBACK_PATH,
  });
}

export function shouldUseNativeAppleAuth(): boolean {
  return Platform.OS === "ios" && Constants.appOwnership !== "expo";
}
