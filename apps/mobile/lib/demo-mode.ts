import { useSyncExternalStore } from "react";
import { resetSampleData } from "@/lib/screenshot-mocks";

let active = false;
const listeners = new Set<() => void>();

export function isDemoMode() { return active; }

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useDemoMode() {
  return useSyncExternalStore(subscribe, isDemoMode, () => false);
}

export function startDemo() {
  resetSampleData();
  active = true;
  listeners.forEach((listener) => listener());
}

export function endDemo() {
  active = false;
  listeners.forEach((listener) => listener());
  resetSampleData();
}
