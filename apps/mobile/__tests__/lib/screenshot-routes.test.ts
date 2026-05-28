import {
  getScreenshotRouteTarget,
  getScreenshotTargetPath,
} from "@/lib/screenshot-routes";

describe("screenshot routes", () => {
  it("routes match screenshots directly to the seeded match reveal", () => {
    const target = getScreenshotRouteTarget("match");

    expect(target).toBe("/(tabs)/exchanges/301/my-match");
    expect(getScreenshotTargetPath(target)).toBe("exchanges/301/my-match");
  });

  it("routes seeded form and detail screens used by full app verification", () => {
    expect(getScreenshotRouteTarget("list-detail")).toBe("/(tabs)/lists/201");
    expect(getScreenshotRouteTarget("gift-detail")).toBe(
      "/(tabs)/lists/gifts/501?holiday_id=201"
    );
    expect(getScreenshotTargetPath(getScreenshotRouteTarget("gift-detail"))).toBe(
      "lists/gifts/501"
    );
    expect(getScreenshotRouteTarget("exchange-wishlist-new")).toBe(
      "/(tabs)/exchanges/wishlist/new?exchange_id=301&participant_id=401"
    );
    expect(getScreenshotRouteTarget("people")).toBe("/(tabs)/people");
    expect(getScreenshotRouteTarget("profile")).toBe("/(tabs)/profile");
    expect(getScreenshotRouteTarget("auth-login")).toBe("/auth/login");
  });

  it("falls back to lists for unknown screenshot routes", () => {
    expect(getScreenshotRouteTarget("unknown")).toBe("/(tabs)/lists");
  });
});
