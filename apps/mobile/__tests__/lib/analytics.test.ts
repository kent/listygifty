import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@/lib/api", () => ({
  analyticsService: {
    captureBatch: jest.fn().mockResolvedValue({ accepted: 2, duplicates: 0, rejected: 0 }),
  },
}));

jest.mock("@/lib/runtime-config", () => ({
  runtimeConfig: { screenshotMode: false },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "12345678-1234-4234-8234-123456789012"),
}));

import { captureMobileEvent, flushAnalyticsEvents } from "@/lib/analytics";
import { runtimeConfig } from "@/lib/runtime-config";
import { analyticsService } from "@/lib/api";

const mockCaptureBatch = analyticsService.captureBatch as jest.MockedFunction<typeof analyticsService.captureBatch>;

describe("mobile first-party analytics", () => {
  beforeEach(async () => {
    mockCaptureBatch.mockClear();
    await AsyncStorage.clear();
  });

  it("batches events and keeps product capture best-effort", async () => {
    expect(runtimeConfig.screenshotMode).toBe(false);
    await captureMobileEvent("mobile_screen_viewed", { path: "/lists" });
    await captureMobileEvent("mobile_gift_idea_captured", { source: "quick_capture" });
    await flushAnalyticsEvents();

    expect(mockCaptureBatch).toHaveBeenCalledTimes(1);
    expect(mockCaptureBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({ event_name: "mobile_screen_viewed", path: "/lists" }),
      expect.objectContaining({ event_name: "mobile_gift_idea_captured" }),
    ]);
  });
});
