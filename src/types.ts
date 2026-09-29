/**
 * SAutocomplete Suggestion — public types.
 * All UI strings default to English and are overridable via `locale`.
 */

export interface SuggestionItem {
  /** Unique id */
  id: string;
  /** Group name this item belongs to (e.g. "Language", "Framework") */
  group: string;
  /** Display label */
  label: string;
}

export interface GroupConfig {
  /** Group name — must match SuggestionItem.group */
  name: string;
  /** Badge background CSS class suffix or raw CSS color. Keep simple: CSS class names used in styles.css */
  badgeBg?: string;
  badgeText?: string;
  badgeBorder?: string;
  /** Optional inline SVG string for the group icon */
  icon?: string;
}

export interface LocaleStrings {
  recentTitle?: string;
  searchPlaceholder?: string;
  clearTitle?: string;
  submitTitle?: string;
  selected?: string;
  items?: string;
  apply?: string;
  done?: string;
  scope?: string;
  tier?: string;
  hits?: string;
  in?: string;
  groups?: string;
  replacing?: string;
  hintBrowse?: string;
  hintMulti?: string;
  hintApply?: string;
  noResults?: string;
}

export type MatchMode = 'accent-insensitive' | 'exact';
export type DropdownPosition = 'bottom' | 'top';

export interface GroupedItem extends SuggestionItem {
  globalIndex: number;
}

export interface MetadataGroup {
  type: string;
  items: GroupedItem[];
}

export interface GroupedResult {
  groups: MetadataGroup[];
  allItems: GroupedItem[];
  totalHits: number;
}

export interface HighlightRange {
  start: number;
  end: number;
  text: string;
  isEntity: boolean;
}

export interface AutocompleteOptions {
  /** CSS selector or container element (required) */
  container: string | HTMLElement;
  /** Placeholder text (English default) */
  placeholder?: string;
  /** Initial query value */
  value?: string;
  /** Full dataset — assumed already available. Grouped by `group`. */
  items?: SuggestionItem[];
  /** Group ordering + theming. Defaults to order of first appearance. */
  groups?: GroupConfig[];
  /** Explicit group order override */
  groupOrder?: string[];
  /** Show dropdown above input instead of below */
  dropup?: boolean;
  /** Disable input */
  disabled?: boolean;
  /** Minimum chars to trigger suggestions (default 1) */
  minChars?: number;
  /** Max recent history entries (default 5, 0 = disabled) */
  maxHistory?: number;
  /** Initial history entries */
  history?: string[];
  /** Accent-insensitive matching by default */
  matchMode?: MatchMode;
  /** Max items per group (0 = unlimited) */
  maxItemsPerGroup?: number;
  /** Max total items */
  maxTotalItems?: number;
  /** Show status bar (timing / hits / replacing) */
  showStatusBar?: boolean;
  /** Show recent history dropdown when input is empty */
  showHistory?: boolean;
  /** Show Apply/Finish button in dropdown header */
  showApplyButton?: boolean;
  /** Extra CSS class on root */
  className?: string;
  /** Custom submit button icon (inline SVG markup, trusted). Defaults to a send icon. */
  submitIcon?: string;
  /** Accent color for focus ring, submit button, staged chips and status (any CSS color). Default teal `#0f766e`. */
  color?: string;
  /** Darker accent variant for hover states. Defaults to a derived shade of `color`. */
  colorDark?: string;
  /** Border radius of the main input bar (any CSS radius or px number). Default `24px`. */
  borderRadius?: string | number;
  /** English locale overrides */
  locale?: LocaleStrings;
  /** Callback on submit (Enter on input / Send button / history click) */
  onSubmit?: (query: string) => void;
  /** Callback on every input change */
  onChange?: (query: string) => void;
  /** Callback when staged multi-select changes */
  onStageChange?: (staged: SuggestionItem[]) => void;
  /** Callback on focus */
  onFocus?: () => void;
  /** Callback on blur */
  onBlur?: () => void;
  /** Callback when instance is ready */
  onReady?: (instance: AutocompleteInstance) => void;
}

export interface AutocompleteInstance {
  getQuery(): string;
  /** Alias of getQuery() — plain text content (parity with rich-editor getText) */
  getText(): string;
  /** True when the query is empty / whitespace only */
  isEmpty(): boolean;
  /** Character count of the current query */
  getCharacterCount(): number;
  /** Word count of the current query */
  getWordCount(): number;
  setQuery(value: string, opts?: { open?: boolean; focus?: boolean }): void;
  clear(): void;
  focus(): void;
  blur(): void;
  submit(overrideQuery?: string): void;
  getStaged(): SuggestionItem[];
  clearStaged(): void;
  getHistory(): string[];
  clearHistory(): void;
  setItems(items: SuggestionItem[]): void;
  getItems(): SuggestionItem[];
  setGroups(groups: GroupConfig[]): void;
  enable(): void;
  disable(): void;
  isDisabled(): boolean;
  /** Switch dropdown direction at runtime */
  setDropup(v: boolean): void;
  /** Update main input border radius at runtime (any CSS radius or px number) */
  setBorderRadius(v: string | number): void;
  getElement(): HTMLElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: 'submit' | 'change' | 'stage' | 'focus' | 'blur', handler: (...args: any[]) => void): () => void;
  destroy(): void;
}
