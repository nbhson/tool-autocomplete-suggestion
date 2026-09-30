import { describe, it, expect } from 'vitest';
import { resolveGroupOrder, toggleStaged, serializeFormValue } from './store';

describe('resolveGroupOrder', () => {
  it('prefers explicit groupOrder', () => {
    expect(resolveGroupOrder([{ id: '1', group: 'B', label: 'x' }], [{ name: 'A' }], ['B', 'A'])).toEqual([
      'B',
      'A',
    ]);
  });

  it('falls back to first-appearance order', () => {
    expect(
      resolveGroupOrder(
        [
          { id: '1', group: 'B', label: 'x' },
          { id: '2', group: 'A', label: 'y' },
        ],
        undefined,
        undefined,
      ),
    ).toEqual(['B', 'A']);
  });
});

describe('toggleStaged', () => {
  it('adds then removes by id', () => {
    const item = { id: '1', group: 'G', label: 'React', globalIndex: 0 };
    const added = toggleStaged([], item);
    expect(added).toHaveLength(1);
    expect(toggleStaged(added, item)).toHaveLength(0);
  });
});

describe('serializeFormValue', () => {
  it('returns query alone when nothing staged', () => {
    expect(serializeFormValue('hello', [])).toBe('hello');
  });

  it('joins staged labels for form submission', () => {
    expect(serializeFormValue('base', ['A', 'B'], ', ')).toBe('base, A, B');
    expect(serializeFormValue('', ['A'], ', ')).toBe('A');
  });
});
