import { describe, expect, it } from "vitest";
import { moveItem } from "./move-item";

describe("moveItem", () => {
  const items = ["a", "b", "c"];

  it("moves an item up", () => {
    expect(moveItem(items, 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("moves an item down", () => {
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("returns a new array and leaves the original alone", () => {
    const moved = moveItem(items, 1, 1);
    expect(moved).not.toBe(items);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("keeps the same array when the move would leave the list", () => {
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 2, 1)).toBe(items);
  });
});
