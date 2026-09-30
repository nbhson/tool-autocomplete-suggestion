import { bench, describe } from 'vitest';
import { getGroupedMetadata } from './matching';
import type { SuggestionItem } from './types';

const big: SuggestionItem[] = Array.from({ length: 20_000 }, (_, i) => ({
  id: `id-${i}`,
  group: ['Language', 'Framework', 'Tool', 'Platform'][i % 4],
  label: `benchmark-item-${i}-typescript`,
}));

describe('matching perf', () => {
  bench('getGroupedMetadata over 20k items', () => {
    getGroupedMetadata(big, 'typescript');
  });
});
