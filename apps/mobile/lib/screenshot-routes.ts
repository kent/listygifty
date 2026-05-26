export type ScreenshotRouteTarget =
  | "/(tabs)/lists"
  | "/(tabs)/exchanges"
  | "/(tabs)/exchanges/301"
  | "/(tabs)/exchanges/301/my-match"
  | "/(tabs)/people/index"
  | "/(tabs)/profile/index";

const DEFAULT_SCREENSHOT_ROUTE: ScreenshotRouteTarget = "/(tabs)/lists";

const SCREENSHOT_ROUTES: Record<string, ScreenshotRouteTarget> = {
  "exchange-detail": "/(tabs)/exchanges/301",
  exchanges: "/(tabs)/exchanges",
  lists: "/(tabs)/lists",
  match: "/(tabs)/exchanges/301/my-match",
  people: "/(tabs)/people/index",
  profile: "/(tabs)/profile/index",
};

export function getScreenshotRouteTarget(routeName: string): ScreenshotRouteTarget {
  return SCREENSHOT_ROUTES[routeName] ?? DEFAULT_SCREENSHOT_ROUTE;
}

export function getScreenshotTargetPath(targetRoute: ScreenshotRouteTarget): string {
  return targetRoute.replace(/^\//, "").replace(/^\(tabs\)\//, "");
}
