import type { GroupConfig, SuggestionItem } from './types';

/**
 * Neutral English sample dataset (dummy tech-stack data).
 * Real apps are expected to pass their own `items` (data is assumed available).
 */
export const DEFAULT_ITEMS: SuggestionItem[] = [
  { id: 'l1', group: 'Language', label: 'TypeScript' },
  { id: 'l2', group: 'Language', label: 'JavaScript' },
  { id: 'l3', group: 'Language', label: 'Python' },
  { id: 'l4', group: 'Language', label: 'Go' },
  { id: 'l5', group: 'Language', label: 'Rust' },
  { id: 'f1', group: 'Framework', label: 'React' },
  { id: 'f2', group: 'Framework', label: 'Vue' },
  { id: 'f3', group: 'Framework', label: 'Angular' },
  { id: 'f4', group: 'Framework', label: 'Svelte' },
  { id: 't1', group: 'Tool', label: 'Vite' },
  { id: 't2', group: 'Tool', label: 'ESLint' },
  { id: 't3', group: 'Tool', label: 'Vitest' },
  { id: 't4', group: 'Tool', label: 'Playwright' },
  { id: 't5', group: 'Tool', label: 'Rollup' },
  { id: 'p1', group: 'Platform', label: 'Web' },
  { id: 'p2', group: 'Platform', label: 'Node.js' },
  { id: 'p3', group: 'Platform', label: 'Desktop' },
  { id: 'p4', group: 'Platform', label: 'Mobile' },
  { id: 'c1', group: 'License', label: 'MIT' },
  { id: 'c2', group: 'License', label: 'Apache-2.0' },
  { id: 'c3', group: 'License', label: 'GPL-3.0' },
  { id: 'a1', group: 'Topic', label: 'Frontend' },
  { id: 'a2', group: 'Topic', label: 'Testing' },
  { id: 'a3', group: 'Topic', label: 'Accessibility' },
  { id: 'a4', group: 'Topic', label: 'Performance' },
];

export const DEFAULT_GROUPS: GroupConfig[] = [
  { name: 'Language' },
  { name: 'Framework' },
  { name: 'Tool' },
  { name: 'Platform' },
  { name: 'License' },
  { name: 'Topic' },
];
