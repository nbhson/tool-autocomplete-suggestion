import { removeAccents, matchesSearch, getGroupedMetadata, isItemInQuery } from './matching';
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
});
