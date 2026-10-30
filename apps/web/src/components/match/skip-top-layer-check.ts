import { vi } from "vitest";

/**
 * Test helper. floating-ui calls element.matches(":modal") up the tree to place a
 * popover. Under jsdom each call overflows the stack (nwsapi re-enters itself), so
 * opening one people picker takes over 10 seconds and the test runs past vitest's
 * timeout. jsdom has no top layer, so the true answer is always false.
 */
export function skipTopLayerCheck() {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    return selector === ":modal" ? false : matches.call(this, selector);
  });
}
