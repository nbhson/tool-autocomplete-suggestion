/**
 * SAutocomplete Suggestion — a lightweight, dependency-free grouped
 * autocomplete suggestion input (Vanilla TypeScript).
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
 */
export { createAutocomplete, DEFAULT_SUBMIT_ICON } from './core';
export { getGroupedMetadata, matchesSearch, removeAccents, isItemInQuery, applySuggestion } from './matching';
export { escapeHTML, escapeAttr } from './sanitizer';
export { getActiveHighlightRange, getQueryWordForSuggestions } from './highlight';
export { DEFAULT_ITEMS, DEFAULT_GROUPS } from './default-data';
export { themeForGroup } from './themes';
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
} from './types';

import { createAutocomplete } from './core';

// Default export for convenience
export default { createAutocomplete };
