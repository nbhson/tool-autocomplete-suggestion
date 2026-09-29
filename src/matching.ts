import type { GroupedResult, GroupedItem, SuggestionItem } from './types';

/**
 * Remove diacritics for flexible matching.
 * Ported 1:1 from ConsentSearchBar4 / GroupedMetadataSuggestions.
 */
export function removeAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Substring + token match with accent insensitivity.
 * NOTE: the original had a hardcoded phonetic rule for 'phong' <-> 'hong'/'chong'.
 * That rule is data-specific demo behavior, so it is now opt-in via `phoneticHints`.
 * By default only generic accent-insensitive matching applies.
 */
export function matchesSearch(
  label: string,
  query: string,
  opts?: { phoneticHints?: Array<[string, string[]]>; exact?: boolean },
): boolean {
  if (!query) return false;
  // Exact mode: literal case-sensitive substring, no accent folding.
  if (opts?.exact) {
    return label.includes(query.trim());
  }
  const normLabel = removeAccents(label);
  const normQuery = removeAccents(query.trim());
  if (!normQuery) return false;

  if (normLabel.includes(normQuery)) return true;

  if (opts?.phoneticHints) {
    for (const [key, alts] of opts.phoneticHints) {
      if (normQuery === key) {
        if (alts.some((a) => normLabel.includes(a))) return true;
      }
    }
  }

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    return queryTokens.every((token) => normLabel.includes(token));
  }
  return false;
}

export interface GetGroupedOptions {
  groupOrder?: string[];
  maxItemsPerGroup?: number;
  maxTotalItems?: number;
  exact?: boolean;
  phoneticHints?: Array<[string, string[]]>;
}

export function getGroupedMetadata(
  items: SuggestionItem[],
  queryWord: string,
  opts: GetGroupedOptions = {},
): GroupedResult {
  const cleanWord = queryWord.trim().toLowerCase();
  if (!cleanWord) {
    return { groups: [], allItems: [], totalHits: 0 };
  }
  // Exact mode matches the raw (case-sensitive) query; default mode is folded.
  const needle = opts.exact ? queryWord.trim() : cleanWord;

  const seen = new Set<string>();
  const order: string[] = [];
  for (const g of opts.groupOrder && opts.groupOrder.length > 0
    ? opts.groupOrder
    : Array.from(new Set(items.map((i) => i.group)))) {
    if (!seen.has(g)) {
      seen.add(g);
      order.push(g);
    }
  }
  // Tolerate items whose group is not listed: append them in appearance order
  // so dynamic setItems() with brand-new groups still yields suggestions.
  for (const item of items) {
    if (!seen.has(item.group)) {
      seen.add(item.group);
      order.push(item.group);
    }
  }

  let globalCount = 0;
  const groups: GroupedResult['groups'] = [];
  const allItems: GroupedItem[] = [];

  for (const groupName of order) {
    const rawMatches = items.filter(
      (m) =>
        m.group === groupName &&
        matchesSearch(m.label, needle, { exact: opts.exact, phoneticHints: opts.phoneticHints }),
    );
    if (rawMatches.length === 0) continue;

    const limited =
      opts.maxItemsPerGroup && opts.maxItemsPerGroup > 0
        ? rawMatches.slice(0, opts.maxItemsPerGroup)
        : rawMatches;

    const groupItems: GroupedItem[] = [];
    for (const m of limited) {
      if (opts.maxTotalItems && opts.maxTotalItems > 0 && allItems.length >= opts.maxTotalItems) break;
      const item: GroupedItem = { id: m.id, group: m.group, label: m.label, globalIndex: globalCount };
      globalCount++;
      allItems.push(item);
      groupItems.push(item);
    }
    if (groupItems.length > 0) {
      groups.push({ type: groupName, items: groupItems });
    }
    if (opts.maxTotalItems && opts.maxTotalItems > 0 && allItems.length >= opts.maxTotalItems) break;
  }

  return { groups, allItems, totalHits: allItems.length };
}

/** Check whether an item label is already present in the query text. */
export function isItemInQuery(query: string, itemText: string): boolean {
  if (!query || !itemText) return false;
  const escaped = itemText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[,\\s])(?:${escaped})(?:[,\\s]|$|\\))`, 'i');
  return regex.test(query);
}

/**
 * Replace the word currently being typed with the chosen suggestion.
 * Ported from applyPredictiveSuggestion (single-select path).
 */
export function applySuggestion(currentInput: string, suggestionText: string): string {
  const endsWithSpace = /\s$/.test(currentInput);
  let result: string;
  if (endsWithSpace || currentInput.trim() === '') {
    result = (currentInput + suggestionText).trim();
  } else {
    const words = currentInput.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const cleanLastWord = lastWord.replace(/[,;:]+$/, '');
    if (cleanLastWord && suggestionText.toLowerCase().startsWith(cleanLastWord.toLowerCase())) {
      words[words.length - 1] = suggestionText;
      result = words.join(' ');
    } else {
      result = (currentInput + ' ' + suggestionText).trim();
    }
  }
  return result.replace(/,\s*$/, '').trim();
}
