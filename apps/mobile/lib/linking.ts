import { Alert, Linking } from "react-native";
import { normalizeExternalUrl } from "@/lib/url";

export async function openExternalUrl(rawUrl: string): Promise<void> {
  const url = normalizeExternalUrl(rawUrl);
  if (!url) {
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error(`Cannot open URL: ${url}`);
    }

    await Linking.openURL(url);
  } catch (error) {
    console.error("Failed to open external URL", error);
    Alert.alert("Unable to open link", "Please check that the URL is valid.");
  }
}
