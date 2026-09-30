/** Windowing helper — keeps DOM small for large hit lists. */
import type { GroupedItem } from './types';

export interface VirtualSlice<T> {
  visible: Array<GroupedItem<T>>;
  truncated: boolean;
  hiddenCount: number;
}

/**
 * Return the first `limit` items when over threshold, otherwise everything.
 * Group structure is preserved by the caller; this is the flat-list primitive
 * used by core + unit tests.
 */
export function virtualSlice<T>(all: Array<GroupedItem<T>>, threshold: number): VirtualSlice<T> {
  const limit = Math.max(0, threshold);
  if (limit <= 0 || all.length <= limit) {
    return { visible: all, truncated: false, hiddenCount: 0 };
  }
  return { visible: all.slice(0, limit), truncated: true, hiddenCount: all.length - limit };
}
