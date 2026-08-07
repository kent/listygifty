import { createAnalyticsService } from "@niftygifty/services";
import type {
  AnalyticsAttribution,
  AnalyticsEventInput,
  AnalyticsProperties,
} from "@niftygifty/types";
import { apiClient } from "@/lib/api-client";

export type { AnalyticsProperties };

const analyticsService = createAnalyticsService(apiClient);
const VISITOR_KEY = "listygifty.analytics.visitor";
const SESSION_KEY = "listygifty.analytics.session";
const FIRST_TOUCH_KEY = "listygifty.analytics.first_touch";
const LAST_TOUCH_KEY = "listygifty.analytics.last_touch";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
] as const;

const queue: AnalyticsEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let landingPage: string | null = null;

const SENSITIVE_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/claim\/[^/]+\/?$/, "/claim/:token"],
  [/^\/email-preferences\/[^/]+\/?$/, "/email-preferences/:token"],
  [/^\/join\/(?:exchange|workspace)\/[^/]+\/?$/, "/join/:kind/:token"],
  [/^\/join\/x\/[^/]+\/?$/, "/join/x/:share_token"],
  [/^\/join\/[^/]+\/?$/, "/join/:token"],
  [/^\/w\/[^/]+\/?$/, "/w/:token"],
  [/^\/e\/[^/]+\/[^/]+\/?$/, "/e/:slug/:share_token"],
];

function trackingSuppressed() {
  if (typeof navigator === "undefined") return true;
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
  return privacyNavigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

function randomId() {
  return crypto.randomUUID();
}

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Analytics remains best-effort when storage is unavailable.
  }
}

function visitorId() {
  const existing = storageGet(VISITOR_KEY);
  if (existing) return existing;
  const created = randomId();
  storageSet(VISITOR_KEY, created);
  return created;
}

function sessionId() {
  const now = Date.now();
  try {
    const existing = JSON.parse(storageGet(SESSION_KEY) || "null") as { id?: string; lastActive?: number } | null;
    if (existing?.id && existing.lastActive && now - existing.lastActive < SESSION_TIMEOUT_MS) {
      storageSet(SESSION_KEY, JSON.stringify({ id: existing.id, lastActive: now }));
      return existing.id;
    }
  } catch {
    // Replace malformed session state.
  }
  const id = randomId();
  storageSet(SESSION_KEY, JSON.stringify({ id, lastActive: now }));
  return id;
}

function currentAttribution(): AnalyticsAttribution {
  const params = new URLSearchParams(window.location.search);
  const current = Object.fromEntries(
    ATTRIBUTION_KEYS.flatMap((key) => {
      const value = params.get(key)?.trim();
      return value ? [[key, value]] : [];
    })
  ) as AnalyticsAttribution;
  if (Object.keys(current).length > 0) {
    if (!storageGet(FIRST_TOUCH_KEY)) storageSet(FIRST_TOUCH_KEY, JSON.stringify(current));
    storageSet(LAST_TOUCH_KEY, JSON.stringify(current));
    return current;
  }
  try {
    return JSON.parse(storageGet(LAST_TOUCH_KEY) || storageGet(FIRST_TOUCH_KEY) || "{}") as AnalyticsAttribution;
  } catch {
    return {};
  }
}

function normalizedPath() {
  const path = window.location.pathname;
  return SENSITIVE_ROUTE_PATTERNS.find(([pattern]) => pattern.test(path))?.[1] || path;
}

function externalReferrer() {
  if (!document.referrer) return undefined;
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? undefined : document.referrer;
  } catch {
    return undefined;
  }
}

function enqueue(event: AnalyticsEventInput) {
  queue.push(event);
  if (queue.length >= 20) {
    void flushAnalyticsEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flushAnalyticsEvents(), 1_500);
  }
}

export async function flushAnalyticsEvents() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, 50);
  try {
    await analyticsService.captureBatch(batch);
  } catch {
    // Never block the product or surface analytics transport failures.
  }
  if (queue.length > 0) void flushAnalyticsEvents();
}

export function captureWebEvent(event: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined" || trackingSuppressed()) return;
  landingPage ||= normalizedPath();
  enqueue({
    event_id: randomId(),
    event_name: event,
    occurred_at: new Date().toISOString(),
    anonymous_id: visitorId(),
    session_id: sessionId(),
    platform: "web",
    path: normalizedPath(),
    referrer: externalReferrer(),
    landing_page: landingPage,
    attribution: currentAttribution(),
    properties,
  });
}
