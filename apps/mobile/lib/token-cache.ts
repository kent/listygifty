import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

function isValidTokenKey(key: string): boolean {
  return typeof key === "string" && key.trim().length > 0;
}

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    if (!isValidTokenKey(key)) return null;

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async saveToken(key: string, value: string) {
    if (!isValidTokenKey(key) || typeof value !== "string") return;

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail on web or other platforms without SecureStore
    }
  },

  async clearToken(key: string) {
    if (!isValidTokenKey(key)) return;

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};
