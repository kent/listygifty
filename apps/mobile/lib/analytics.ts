import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import type { AnalyticsEventInput, AnalyticsProperties } from "@niftygifty/types";
import { analyticsService } from "@/lib/api";
import { runtimeConfig } from "@/lib/runtime-config";

const VISITOR_KEY = "listygifty.analytics.visitor";
const SESSION_KEY = "listygifty.analytics.session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 1_500;
const MAX_BATCH_SIZE = 20;

let visitorPromise: Promise<string> | null = null;
let sessionStatePromise: Promise<{ id: string; lastActive: number }> | null = null;
let sessionPersistTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const queue: AnalyticsEventInput[] = [];

async function visitorId() {
  visitorPromise ||= AsyncStorage.getItem(VISITOR_KEY).then(async (existing) => {
    if (existing) return existing;
    const created = randomUUID();
    await AsyncStorage.setItem(VISITOR_KEY, created);
    return created;
  });
  return visitorPromise;
}

async function sessionId() {
  const now = Date.now();
  sessionStatePromise ||= AsyncStorage.getItem(SESSION_KEY).then((stored) => {
    try {
      const existing = JSON.parse(stored || "null") as { id?: string; lastActive?: number } | null;
      if (existing?.id && existing.lastActive && now - existing.lastActive < SESSION_TIMEOUT_MS) {
        return { id: existing.id, lastActive: now };
      }
    } catch {
      // Replace malformed state below.
    }
    return { id: randomUUID(), lastActive: now };
  });
  let state = await sessionStatePromise;
  if (now - state.lastActive >= SESSION_TIMEOUT_MS) {
    state = { id: randomUUID(), lastActive: now };
    sessionStatePromise = Promise.resolve(state);
  } else {
    state.lastActive = now;
  }
  scheduleSessionPersist(state);
  return state.id;
}

function scheduleSessionPersist(state: { id: string; lastActive: number }) {
  if (sessionPersistTimer) clearTimeout(sessionPersistTimer);
  sessionPersistTimer = setTimeout(() => {
    sessionPersistTimer = null;
    void AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state)).catch(() => {
      // Analytics identity persistence is best-effort.
    });
  }, FLUSH_DELAY_MS);
}

function analyticsPlatform(): "ios" | "android" | "unknown" {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return "unknown";
}

export function useAnalytics() {
  return useCallback((event: string, properties?: AnalyticsProperties) => {
    void captureMobileEvent(event, properties);
  }, []);
}

export async function captureMobileEvent(event: string, properties?: AnalyticsProperties) {
  if (runtimeConfig.screenshotMode) return;

  try {
    const [anonymousId, currentSessionId] = await Promise.all([visitorId(), sessionId()]);
    enqueue({
      event_id: randomUUID(),
      event_name: event,
      occurred_at: new Date().toISOString(),
      anonymous_id: anonymousId,
      session_id: currentSessionId,
      platform: analyticsPlatform(),
      path: typeof properties?.path === "string" ? properties.path : undefined,
      properties,
    });
  } catch {
    // Product actions never fail because analytics is unavailable.
  }
}

function enqueue(event: AnalyticsEventInput) {
  queue.push(event);
  if (queue.length >= MAX_BATCH_SIZE) {
    void flushAnalyticsEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flushAnalyticsEvents(), FLUSH_DELAY_MS);
  }
}

export async function flushAnalyticsEvents() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (sessionPersistTimer) {
    clearTimeout(sessionPersistTimer);
    sessionPersistTimer = null;
    const state = await sessionStatePromise;
    if (state) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state)).catch(() => {
        // Analytics identity persistence is best-effort.
      });
    }
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH_SIZE);
  try {
    await analyticsService.captureBatch(batch);
  } catch {
    // Product actions never fail because analytics is unavailable.
  }
  if (queue.length > 0) void flushAnalyticsEvents();
}
