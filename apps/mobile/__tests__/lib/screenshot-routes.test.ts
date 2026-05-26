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

  it("falls back to lists for unknown screenshot routes", () => {
    expect(getScreenshotRouteTarget("unknown")).toBe("/(tabs)/lists");
  });
});
