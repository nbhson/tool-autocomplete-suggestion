import { describe, it, expect } from 'vitest';
import { virtualSlice } from './virtualize';
import type { GroupedItem } from './types';

const mk = (n: number): Array<GroupedItem> =>
  Array.from({ length: n }, (_, i) => ({ id: `${i}`, group: 'G', label: `item-${i}`, globalIndex: i }));

describe('virtualSlice', () => {
  it('returns everything under threshold', () => {
    const r = virtualSlice(mk(10), 200);
    expect(r.visible).toHaveLength(10);
    expect(r.truncated).toBe(false);
    expect(r.hiddenCount).toBe(0);
  });

  it('caps visible items and reports hidden count over threshold', () => {
    const r = virtualSlice(mk(500), 200);
    expect(r.visible).toHaveLength(200);
    expect(r.truncated).toBe(true);
    expect(r.hiddenCount).toBe(300);
  });

  it('threshold 0 disables virtualization', () => {
    const r = virtualSlice(mk(50), 0);
    expect(r.visible).toHaveLength(50);
    expect(r.truncated).toBe(false);
  });
});
