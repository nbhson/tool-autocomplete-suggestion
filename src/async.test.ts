import { describe, it, expect, vi } from 'vitest';
import { debounce, QueryCache } from './async';

describe('debounce', () => {
  it('coalesces rapid calls into one', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d.run('a');
    d.run('b');
    d.run('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });

  it('cancel() drops pending calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.run('x');
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('QueryCache', () => {
  it('stores and retrieves by key', () => {
    const c = new QueryCache<string>(2);
    c.set('a', ['1']);
    expect(c.get('a')).toEqual(['1']);
    expect(c.size).toBe(1);
  });

  it('evicts oldest entry past capacity (FIFO)', () => {
    const c = new QueryCache<string>(2);
    c.set('a', ['1']);
    c.set('b', ['2']);
    c.set('c', ['3']);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('c')).toEqual(['3']);
  });
});
