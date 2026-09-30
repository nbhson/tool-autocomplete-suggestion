/**
 * Query store — extracted state helpers so core.ts stays thin.
 * Pure functions, fully unit-testable without DOM.
 */
import type { GroupedItem, SuggestionItem } from './types';

export function resolveGroupOrder(
  items: Array<SuggestionItem<unknown>>,
  groups: Array<{ name: string }> | undefined,
  groupOrder: string[] | undefined,
): string[] {
  if (groupOrder && groupOrder.length > 0) return [...new Set(groupOrder)];
  if (groups && groups.length > 0) return [...new Set(groups.map((g) => g.name))];
  if (items.length === 0) return [];
  return [...new Set(items.map((i) => i.group))];
}

export function toggleStaged<T>(
  staged: Array<GroupedItem<T>>,
  item: GroupedItem<T>,
): Array<GroupedItem<T>> {
  const key = (s: GroupedItem<T>) => `${s.id}::${s.label.toLowerCase()}`;
  const exists = staged.some((s) => key(s) === key(item));
  return exists ? staged.filter((s) => key(s) !== key(item)) : [...staged, item];
}

export function serializeFormValue(query: string, stagedLabels: string[], join = ', '): string {
  const q = query.trim();
  if (stagedLabels.length === 0) return q;
  const extra = stagedLabels.join(join).trim();
  if (!q) return extra;
  if (q.toLowerCase().includes(extra.toLowerCase())) return q;
  return `${q}${join}${extra}`.trim();
}
