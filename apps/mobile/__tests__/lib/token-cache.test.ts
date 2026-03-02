import * as SecureStore from "expo-secure-store";
import { tokenCache } from "@/lib/token-cache";

jest.mock("expo-secure-store");

describe("tokenCache", () => {
  const saveToken = tokenCache.saveToken!;
  const clearToken = tokenCache.clearToken!;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getToken", () => {
    it("returns token from SecureStore", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("test-token");

      const result = await tokenCache.getToken("clerk-token");

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("clerk-token");
      expect(result).toBe("test-token");
    });

    it("returns null when SecureStore throws", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error("Failed"));

      const result = await tokenCache.getToken("clerk-token");

      expect(result).toBeNull();
    });

    it("returns null and skips SecureStore when key is invalid", async () => {
      const result = await tokenCache.getToken("");

      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("saveToken", () => {
    it("saves token to SecureStore", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveToken("clerk-token", "new-token");

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("clerk-token", "new-token");
    });

    it("does not throw when SecureStore fails", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error("Failed"));

      // Should not throw
      await expect(saveToken("clerk-token", "new-token")).resolves.toBeUndefined();
    });

    it("skips SecureStore when key or value is invalid", async () => {
      await saveToken("", "new-token");
      await saveToken("clerk-token", undefined as unknown as string);

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("clearToken", () => {
    it("deletes token from SecureStore", async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await clearToken("clerk-token");

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("clerk-token");
    });

    it("does not throw when SecureStore fails", async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error("Failed"));

      // Should not throw
      await expect(clearToken("clerk-token")).resolves.toBeUndefined();
    });

    it("skips SecureStore when key is invalid", async () => {
      await clearToken("");

      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });
});
