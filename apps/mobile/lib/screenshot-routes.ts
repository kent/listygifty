export type ScreenshotRouteTarget = string;

const DEFAULT_SCREENSHOT_ROUTE: ScreenshotRouteTarget = "/(tabs)/lists";

const SCREENSHOT_ROUTES: Record<string, ScreenshotRouteTarget> = {
  "auth-login": "/auth/login",
  "auth-signup": "/auth/signup",
  "exchange-detail": "/(tabs)/exchanges/301",
  "exchange-new": "/(tabs)/exchanges/new",
  "exchange-participant-new": "/(tabs)/exchanges/301/participants/new",
  "exchange-wishlist": "/(tabs)/exchanges/301/my-wishlist",
  "exchange-wishlist-new": "/(tabs)/exchanges/wishlist/new?exchange_id=301&participant_id=401",
  exchanges: "/(tabs)/exchanges",
  "gift-detail": "/(tabs)/lists/gifts/501?holiday_id=201",
  "gift-new": "/(tabs)/lists/gifts/new?holiday_id=201",
  "gift-quick-new": "/(tabs)/lists/gifts/new",
  invite: "/join/exchange/review-riley-301",
  "list-detail": "/(tabs)/lists/201",
  "list-new": "/(tabs)/lists/new",
  lists: "/(tabs)/lists",
  match: "/(tabs)/exchanges/301/my-match",
  people: "/(tabs)/people",
  profile: "/(tabs)/profile",
};

let selectedScreenshotRouteName: string | null = null;

function readQueryRouteName(): string | null {
  const location = (globalThis as { location?: { search?: string } }).location;
  if (!location?.search) {
    return null;
  }

  const params = new URLSearchParams(location.search);
  const routeName = params.get("screenshotRoute") ?? params.get("route");
  return routeName?.trim() || null;
}

export function getActiveScreenshotRouteName(defaultRouteName: string): string {
  const queryRouteName = readQueryRouteName();

  if (queryRouteName) {
    selectedScreenshotRouteName = queryRouteName;
    return queryRouteName;
  }

  if (selectedScreenshotRouteName) {
    return selectedScreenshotRouteName;
  }

  selectedScreenshotRouteName = defaultRouteName;
  return selectedScreenshotRouteName;
}

export function getScreenshotRouteTarget(routeName: string): ScreenshotRouteTarget {
  return SCREENSHOT_ROUTES[routeName] ?? DEFAULT_SCREENSHOT_ROUTE;
}

export function getScreenshotTargetPath(targetRoute: ScreenshotRouteTarget): string {
  return targetRoute.split("?")[0].replace(/^\//, "").replace(/^\(tabs\)\//, "");
}
