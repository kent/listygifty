import { Platform } from "react-native";

export function isIOS26OrHigher(): boolean {
  if (Platform.OS !== "ios") return false;

  const rawVersion = Platform.Version;
  const versionString = typeof rawVersion === "string" ? rawVersion : String(rawVersion);
  const majorVersion = Number.parseInt(versionString.split(".")[0], 10);

  return Number.isFinite(majorVersion) && majorVersion >= 26;
}
