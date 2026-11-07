export interface PaletteAction {
  id: string;
  label: string;
  keywords?: string;
  hint?: string;
}

// Every whitespace-separated term must appear in the label or keywords. Matches at the start of
// the label rank first, then earlier matches, then original order, so results are predictable.
export function filterActions<T extends PaletteAction>(actions: readonly T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...actions];

  const scored: Array<{ action: T; score: number; order: number }> = [];
  actions.forEach((action, order) => {
    const label = action.label.toLowerCase();
    const haystack = `${label} ${(action.keywords ?? "").toLowerCase()}`;
    if (!terms.every((term) => haystack.includes(term))) return;
    const first = terms[0] ?? "";
    const score = label.startsWith(first)
      ? 0
      : label.includes(first)
        ? 1 + label.indexOf(first) / 100
        : 2;
    scored.push({ action, score, order });
  });
  return scored.sort((a, b) => a.score - b.score || a.order - b.order).map((entry) => entry.action);
}

export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}
