/** "1 item", "2 items". Pass `plural` when adding an "s" isn't right. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
