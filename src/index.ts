/**
 * SAutocomplete Suggestion — a lightweight, dependency-free grouped
 * autocomplete suggestion input (Vanilla TypeScript, enterprise edition).
 *
 * Sync, async (dataSource), virtualized, sanitized, form-ready.
 *
 * @example
 * ```ts
 * import { createAutocomplete } from 'sautocomplete-suggestion';
 * import 'sautocomplete-suggestion/dist/styles.css';
 *
 * const editor = createAutocomplete({
 *   container: '#editor',
 *   items: [
 *     { id: 'l1', group: 'Language', label: 'TypeScript' },
 *     { id: 'f1', group: 'Framework', label: 'React' },
 *   ],
 *   placeholder: 'Search languages, frameworks...',
 *   onSubmit: (query) => console.log('Submitted:', query),
 *   onChange: (query) => console.log('Query:', query),
 *   onStageChange: (staged) => console.log('Staged:', staged),
 * });
 *
 * editor.setQuery('typ');
 * console.log(editor.getQuery()); // "typ"
 * console.log(editor.getWordCount()); // 1
 * editor.destroy();
 * ```
 *
 * @example Async remote source
 * ```ts
 * const remote = createAutocomplete({
 *   container: '#editor',
 *   dataSource: async ({ query, signal }) => {
 *     const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal });
 *     return res.json(); // SuggestionItem[]
 *   },
 *   debounceMs: 200,
 *   onAsyncError: console.error,
 * });
 * ```
 */
export { createAutocomplete, DEFAULT_SUBMIT_ICON } from './core';
export { getGroupedMetadata, matchesSearch, removeAccents, isItemInQuery, applySuggestion } from './matching';
export { escapeHTML, escapeAttr } from './sanitizer';
export { sanitizeSvgMarkup, isSafeSvgMarkup } from './icons';
export { getActiveHighlightRange, getQueryWordForSuggestions } from './highlight';
export { DEFAULT_ITEMS, DEFAULT_GROUPS } from './default-data';
export { themeForGroup } from './themes';
export { debounce, QueryCache } from './async';
export { createMemoryHistory, createLocalStorageHistory } from './history';
export { noopLogger, consoleLogger, resolveLogger } from './logger';
export { virtualSlice } from './virtualize';
export { resolveGroupOrder, toggleStaged, serializeFormValue } from './store';
export { createHiddenInput } from './form';
export type {
  SuggestionItem,
  GroupConfig,
  LocaleStrings,
  AutocompleteOptions,
  AutocompleteInstance,
  GroupedItem,
  MetadataGroup,
  GroupedResult,
  HighlightRange,
  DataSourceFn,
  DataSourceRequest,
  HistoryAdapter,
  Logger,
  SearchTelemetry,
  TelemetryEvents,
  DesignTokens,
  ThemeMode,
  DensityMode,
  TextDirection,
} from './types';

import { createAutocomplete } from './core';

// Default export for convenience
export default { createAutocomplete };
