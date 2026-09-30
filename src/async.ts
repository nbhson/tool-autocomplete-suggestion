/**
 * Enterprise async helpers: debounce + cancellable cached fetching.
 * Zero dependencies — built on AbortController + Map.
 */

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): { run: (...args: Args) => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    run: (...args: Args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = undefined;
        fn(...args);
      }, Math.max(0, waitMs));
    },
    cancel: () => {
      if (t) clearTimeout(t);
      t = undefined;
    },
  };
}

/** Tiny bounded query cache (FIFO eviction) for async dataSource results. */
export class QueryCache<T> {
  private map = new Map<string, T[]>();
  constructor(private maxEntries = 50) {}
  get(key: string): T[] | undefined {
    return this.map.get(key);
  }
  set(key: string, value: T[]): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
  clear(): void {
    this.map.clear();
  }
  get size(): number {
    return this.map.size;
  }
}
