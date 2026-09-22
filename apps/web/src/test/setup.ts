import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest exposes the original jsdom instance even when window aliases the Node global.
const browserStorage = (globalThis as unknown as { jsdom: { window: { localStorage: Storage } } }).jsdom.window.localStorage;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: browserStorage });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
