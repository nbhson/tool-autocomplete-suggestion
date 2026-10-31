import { removeAccents, matchesSearch, getGroupedMetadata, isItemInQuery, applySuggestion } from './matching';
import { describe, it, expect } from 'vitest';
import { DEFAULT_ITEMS } from './default-data';

describe('removeAccents', () => {
  it('strips Vietnamese diacritics', () => {
    expect(removeAccents('Phòng')).toBe('phong');
    expect(removeAccents('Đà Nẵng')).toBe('da nang');
  });
});

describe('matchesSearch', () => {
  it('matches accent-insensitively', () => {
    expect(matchesSearch('Accessibility', 'access')).toBe(true);
    expect(matchesSearch('Café Menu', 'cafe')).toBe(true);
    expect(matchesSearch('TypeScript', 'typ')).toBe(true);
    expect(matchesSearch('TypeScript', 'xyz')).toBe(false);
  });
  it('returns false on empty query', () => {
    expect(matchesSearch('TypeScript', '')).toBe(false);
  });
  it('exact mode is a literal case-sensitive substring', () => {
    expect(matchesSearch('TypeScript', 'Type', { exact: true })).toBe(true);
    expect(matchesSearch('TypeScript', 'type', { exact: true })).toBe(false);
    expect(matchesSearch('Accessibility', 'access', { exact: true })).toBe(false);
  });
});

describe('getGroupedMetadata', () => {
  it('groups hits by group order', () => {
    const res = getGroupedMetadata(DEFAULT_ITEMS, 'typ', { groupOrder: ['Language', 'Framework'] });
    expect(res.totalHits).toBeGreaterThan(0);
    expect(res.groups[0].type).toBe('Language');
  });
  it('returns empty on empty query', () => {
    const res = getGroupedMetadata(DEFAULT_ITEMS, '   ');
    expect(res.totalHits).toBe(0);
  });
  it('appends unlisted groups instead of dropping them', () => {
    const res = getGroupedMetadata(
      [{ id: '1', group: 'Movie', label: 'Dune' }],
      'du',
      { groupOrder: ['Language'] },
    );
    expect(res.totalHits).toBe(1);
    expect(res.groups[0].type).toBe('Movie');
  });
  it('respects maxItemsPerGroup', () => {
    const res = getGroupedMetadata(DEFAULT_ITEMS, 'a', { maxItemsPerGroup: 1 });
    res.groups.forEach((g) => expect(g.items.length).toBeLessThanOrEqual(1));
  });
});

describe('isItemInQuery', () => {
  it('detects item in comma list', () => {
    expect(isItemInQuery('React, Vue', 'Vue')).toBe(true);
    expect(isItemInQuery('React', 'Vue')).toBe(false);
  });
  it('matches at word start and end boundaries', () => {
    expect(isItemInQuery('Vue is fast', 'Vue')).toBe(true);
    expect(isItemInQuery('I like, Vue', 'Vue')).toBe(true);
    // a bare "(" before the word is not a recognized boundary (documented behavior)
    expect(isItemInQuery('I like (Vue)', 'Vue')).toBe(false);
    expect(isItemInQuery('avue', 'Vue')).toBe(false);
  });
});

describe('matchesSearch extras', () => {
  it('multi-token queries require every token', () => {
    expect(matchesSearch('Dune Part Two', 'dune two')).toBe(true);
    expect(matchesSearch('Dune Part Two', 'dune three')).toBe(false);
  });

  it('phoneticHints match alternative spellings', () => {
    const hints: Array<[string, string[]]> = [['phong', ['hong', 'chong']]];
    expect(matchesSearch('Phòng', 'phong', { phoneticHints: hints })).toBe(true);
    expect(matchesSearch('Hong Kong', 'phong', { phoneticHints: hints })).toBe(true);
    expect(matchesSearch('Kyoto', 'phong', { phoneticHints: hints })).toBe(false);
  });
});

describe('applySuggestion', () => {
  it('replaces the last word when it is a prefix of the suggestion', () => {
    expect(applySuggestion('typ', 'TypeScript')).toBe('TypeScript');
    expect(applySuggestion('learn typ', 'TypeScript')).toBe('learn TypeScript');
  });

  it('appends with a space when the last word is unrelated', () => {
    expect(applySuggestion('hello', 'React')).toBe('hello React');
  });

  it('appends directly after a trailing space', () => {
    expect(applySuggestion('hello ', 'React')).toBe('hello React');
    expect(applySuggestion('', 'React')).toBe('React');
  });

  it('strips trailing commas and trims the result', () => {
    expect(applySuggestion('react,', 'Vue')).toBe('react, Vue');
    // a standalone "," is treated as an unrelated word (known quirk)
    expect(applySuggestion('react ,', 'TypeScript')).toBe('react , TypeScript');
  });
});
