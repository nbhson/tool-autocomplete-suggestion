import { describe, it, expect } from 'vitest';
import { getActiveHighlightRange, getQueryWordForSuggestions, knownLabelsFromItems } from './highlight';

describe('getActiveHighlightRange', () => {
  const labels = ['TypeScript', 'React'];

  it('returns null on empty input', () => {
    expect(getActiveHighlightRange('', 0, labels)).toBeNull();
  });

  it('detects a known entity under the cursor (case-insensitive)', () => {
    const r = getActiveHighlightRange('learn typescript now', 8, labels);
    expect(r).toEqual({ start: 6, end: 16, text: 'typescript', isEntity: true });
  });

  it('picks the longest matching entity first', () => {
    const r = getActiveHighlightRange('react native', 2, ['React Native', 'React']);
    expect(r?.isEntity).toBe(true);
    expect(r?.text).toBe('react native');
  });

  it('finds entities at any occurrence, not just the first', () => {
    const r = getActiveHighlightRange('react + react', 10, ['React']);
    expect(r).toEqual({ start: 8, end: 13, text: 'react', isEntity: true });
  });

  it('falls back to the plain word at the cursor', () => {
    const r = getActiveHighlightRange('hello foo world', 8, labels);
    expect(r).toEqual({ start: 6, end: 9, text: 'foo', isEntity: false });
  });

  it('stops at separators (space, comma, semicolon, colon, parens)', () => {
    const r = getActiveHighlightRange('a, (b);c', 4, labels);
    expect(r?.text).toBe('b');
  });

  it('returns null when the cursor sits between separators', () => {
    // cursor on the space/comma gap finds no word
    expect(getActiveHighlightRange('a, b', 2, labels)).toBeNull();
  });
});

describe('getQueryWordForSuggestions', () => {
  it('uses the range text when a range exists', () => {
    expect(getQueryWordForSuggestions('x foo y', { start: 2, end: 5, text: 'foo', isEntity: false })).toBe('foo');
  });

  it('trims trailing punctuation from the last word without a range', () => {
    expect(getQueryWordForSuggestions('hello world,', null)).toBe('world');
    expect(getQueryWordForSuggestions('hello;', null)).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(getQueryWordForSuggestions('', null)).toBe('');
  });
});

describe('knownLabelsFromItems', () => {
  it('maps items to labels', () => {
    expect(knownLabelsFromItems([
      { id: '1', group: 'G', label: 'A' },
      { id: '2', group: 'G', label: 'B' },
    ])).toEqual(['A', 'B']);
  });
});
