/**
 * Moves one item a step up (-1) or down (1). Returns the same array when the
 * move would leave the list, so callers can tell nothing changed.
 */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;

  const moved = [...items];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}
