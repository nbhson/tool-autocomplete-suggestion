/**
 * Pluggable history persistence.
 * Memory adapter is the default (no side effects, GDPR-safe).
 * LocalStorage adapter is opt-in via createLocalStorageHistory().
 */
import type { HistoryAdapter } from './types';

export function createMemoryHistory(initial: string[] = [], maxHistory = 5): {
  adapter: HistoryAdapter;
  get(): string[];
  push(q: string): string[];
  setAll(next: string[]): string[];
} {
  let list = [...initial].slice(0, Math.max(maxHistory, 0));
  const norm = (arr: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of arr) {
      const t = h.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out.slice(0, Math.max(maxHistory, 0));
  };
  list = norm(list);
  return {
    adapter: {
      load: () => [...list],
      save: (h) => {
        list = norm(h);
      },
      clear: () => {
        list = [];
      },
    },
    get: () => [...list],
    push: (q: string) => {
      const t = q.trim();
      if (t && maxHistory > 0) list = norm([t, ...list.filter((h) => h !== t)]);
      return [...list];
    },
    setAll: (next: string[]) => {
      list = norm(next);
      return [...list];
    },
  };
}

export function createLocalStorageHistory(
  key = 'sautocomplete:history',
  maxHistory = 5,
): HistoryAdapter {
  const read = (): string[] => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, Math.max(maxHistory, 0));
    } catch {
      return [];
    }
  };
  return {
    load: () => read(),
    save: (h) => {
      try {
        localStorage?.setItem(key, JSON.stringify(h.slice(0, Math.max(maxHistory, 0))));
      } catch {
        /* storage full / blocked — stay in-memory */
      }
    },
    clear: () => {
      try {
        localStorage?.removeItem(key);
      } catch {
        /* noop */
      }
    },
  };
}
