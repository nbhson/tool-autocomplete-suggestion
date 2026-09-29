import type { HighlightRange, SuggestionItem } from './types';

/**
 * Determine the active highlighted range based on cursor position.
 * Ported 1:1 from ConsentSearchBar4:
 * 1. cursor inside any known entity (longest first) -> isEntity: true
 * 2. else word at cursor -> isEntity: false
 */
export function getActiveHighlightRange(
  input: string,
  cursorPos: number,
  knownLabels: string[],
): HighlightRange | null {
  if (!input) return null;

  const candidateEntities = Array.from(new Set(knownLabels)).sort((a, b) => b.length - a.length);

  const lowerInput = input.toLowerCase();
  for (const entity of candidateEntities) {
    if (!entity) continue;
    const lowerEntity = entity.toLowerCase();
    let searchIdx = 0;
    let idx = lowerInput.indexOf(lowerEntity, searchIdx);
    while (idx !== -1) {
      const start = idx;
      const end = idx + entity.length;
      if (cursorPos >= start && cursorPos <= end) {
        return { start, end, text: input.substring(start, end), isEntity: true };
      }
      searchIdx = end;
      idx = lowerInput.indexOf(lowerEntity, searchIdx);
    }
  }

  let wordStart = cursorPos;
  while (wordStart > 0 && !/[\s,;:()]/.test(input[wordStart - 1])) {
    wordStart--;
  }
  let wordEnd = cursorPos;
  while (wordEnd < input.length && !/[\s,;:()]/.test(input[wordEnd])) {
    wordEnd++;
  }
  const currentWord = input.substring(wordStart, wordEnd).trim();
  if (currentWord.length > 0) {
    return { start: wordStart, end: wordEnd, text: currentWord, isEntity: false };
  }
  return null;
}

/** Derive the query word used for suggestions from highlight range or last word. */
export function getQueryWordForSuggestions(input: string, range: HighlightRange | null): string {
  if (range) return range.text.trim();
  const words = input.split(/\s+/);
  const activeWord = words[words.length - 1] || '';
  return activeWord.replace(/[,;:]+$/, '').trim();
}

export function knownLabelsFromItems(items: SuggestionItem[]): string[] {
  return items.map((i) => i.label);
}
