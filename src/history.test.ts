import { describe, it, expect } from 'vitest';
import { createMemoryHistory, createLocalStorageHistory } from './history';

describe('createMemoryHistory', () => {
  it('pushes newest-first and dedupes', () => {
    const h = createMemoryHistory([], 5);
    h.push('React');
    h.push('Vue');
    h.push('React');
    expect(h.get()).toEqual(['React', 'Vue']);
  });

  it('respects maxHistory cap', () => {
    const h = createMemoryHistory([], 2);
    h.push('a');
    h.push('b');
    h.push('c');
    expect(h.get()).toEqual(['c', 'b']);
  });

  it('adapter save/load round-trips', () => {
    const h = createMemoryHistory(['x'], 5);
    h.adapter.save(['a', 'b']);
    expect(h.adapter.load()).toEqual(['a', 'b']);
  });
});

describe('createLocalStorageHistory', () => {
  it('returns [] when storage is unavailable or corrupt', () => {
    const adapter = createLocalStorageHistory('sa-test-missing-key-xyz', 5);
    // jsdom ships a localStorage; missing key must yield []
    expect(adapter.load()).toEqual([]);
  });

  it('persists and clears via localStorage', () => {
    const adapter = createLocalStorageHistory('sa-test-key', 5);
    adapter.save(['one', 'two']);
    expect(adapter.load()).toEqual(['one', 'two']);
    adapter.clear();
    expect(adapter.load()).toEqual([]);
  });
});
