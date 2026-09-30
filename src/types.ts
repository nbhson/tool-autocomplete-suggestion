/**
 * SAutocomplete Suggestion — public types (enterprise edition).
 * All UI strings default to English and are overridable via `locale`.
 * Generic payload `T` lets hosts attach domain data without casting.
 */

export interface SuggestionItem<T = unknown> {
  /** Unique id */
  id: string;
  /** Group name this item belongs to (e.g. "Language", "Framework") */
  group: string;
  /** Display label */
  label: string;
  /** Optional domain payload (never rendered, passed back on select/submit) */
  data?: T;
  /** When true the item is not selectable (aria-disabled) */
  disabled?: boolean;
}

export interface GroupConfig {
  /** Group name — must match SuggestionItem.group */
  name: string;
  /** Badge background CSS class suffix or raw CSS color. Keep simple: CSS class names used in styles.css */
  badgeBg?: string;
  badgeText?: string;
  badgeBorder?: string;
  /** Optional inline SVG string for the group icon (sanitized before render) */
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
  /** Enterprise additions */
  loading?: string;
  loadError?: string;
  retry?: string;
  empty?: string;
  showMore?: string;
}

export type MatchMode = 'accent-insensitive' | 'exact';
export type DropdownPosition = 'bottom' | 'top';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'comfortable' | 'compact';
export type TextDirection = 'ltr' | 'rtl' | 'auto';

export interface GroupedItem<T = unknown> extends SuggestionItem<T> {
  globalIndex: number;
}

export interface MetadataGroup<T = unknown> {
  type: string;
  items: GroupedItem<T>[];
}

export interface GroupedResult<T = unknown> {
  groups: MetadataGroup<T>[];
  allItems: GroupedItem<T>[];
  totalHits: number;
  /** True when the list was truncated by virtualization/limits */
  truncated?: boolean;
}

export interface HighlightRange {
  start: number;
  end: number;
  text: string;
  isEntity: boolean;
}

/** Async data provider — enterprise remote-search contract. */
export interface DataSourceRequest {
  /** Active word at the cursor (already trimmed) */
  query: string;
  /** Full input value */
  fullQuery: string;
  /** AbortSignal for cancellation (debounce / stale requests) */
  signal: AbortSignal;
}

export type DataSourceFn<T = unknown> = (
  req: DataSourceRequest,
) => Promise<Array<SuggestionItem<T>>>;

/** Pluggable history persistence (memory default, localStorage optional). */
export interface HistoryAdapter {
  load(): string[] | Promise<string[]>;
  save(history: string[]): void | Promise<void>;
  clear(): void | Promise<void>;
}

/** Minimal pluggable logger — defaults to no-op unless `debug: true`. */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface SearchTelemetry {
  query: string;
  hits: number;
  groups: number;
  elapsedMs: number;
  source: 'sync' | 'async' | 'cache';
}

export interface TelemetryEvents {
  onSearch?: (info: SearchTelemetry) => void;
  onSelect?: (item: SuggestionItem<unknown>) => void;
  onError?: (err: unknown) => void;
}

export interface DesignTokens {
  /** Force color scheme regardless of prefers-color-scheme */
  theme?: ThemeMode;
  /** Compact density for data-dense enterprise screens */
  density?: DensityMode;
  /** Text direction — 'auto' follows document.dir */
  direction?: TextDirection;
  /** Cap dropdown height (any CSS length, default 360px) */
  maxDropdownHeight?: string | number;
  /** Font stack for the whole component (sets --sa-font) */
  fontFamily?: string;
  /** Input font size, px number or any CSS length (sets --sa-font-size) */
  fontSize?: string | number;
  /** Surface background (sets --sa-bg) */
  background?: string;
  /** Primary text color (sets --sa-fg) */
  foreground?: string;
  /** Border color (sets --sa-border) */
  borderColor?: string;
  /** Secondary text color (sets --sa-muted) */
  mutedColor?: string;
  /** Dropdown panel radius, px number or any CSS radius (sets --sa-drop-radius) */
  dropdownRadius?: string | number;
  /** Dropdown panel shadow (sets --sa-shadow) */
  shadow?: string;
  /**
   * Escape hatch — arbitrary CSS custom properties applied to the root.
   * Keys may be `'--sa-foo'` or `'sa-foo'`. Invalid names are ignored.
   */
  cssVars?: Record<string, string>;
}

export interface AutocompleteOptions<T = unknown> {
  /** CSS selector or container element (required) */
  container: string | HTMLElement;
  /** Placeholder text (English default) */
  placeholder?: string;
  /** Initial query value */
  value?: string;
  /** Full dataset — assumed already available. Grouped by `group`. */
  items?: Array<SuggestionItem<T>>;
  /**
   * Async provider for remote datasets. When set, it takes precedence over
   * `items` for suggestion filtering (sync items remain as fallback/known labels).
   */
  dataSource?: DataSourceFn<T>;
  /** Debounce for async dataSource (ms, default 200). Sync path stays immediate. */
  debounceMs?: number;
  /** Cache async results by query string (default true) */
  asyncCache?: boolean;
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
  /** Pluggable history persistence. Defaults to in-memory. */
  historyAdapter?: HistoryAdapter;
  /** Storage key used by `createLocalStorageHistory()` (default 'sautocomplete:history') */
  historyKey?: string;
  /** Accent-insensitive matching by default */
  matchMode?: MatchMode;
  /** Max items per group (0 = unlimited) */
  maxItemsPerGroup?: number;
  /** Max total items */
  maxTotalItems?: number;
  /**
   * Virtualization threshold — when total hits exceed this number only the
   * first N items are rendered with a "show more" footer (default 200).
   * Keeps DOM small for 10k+ row datasets.
   */
  virtualizeThreshold?: number;
  /** Show status bar (timing / hits / replacing) */
  showStatusBar?: boolean;
  /** Show recent history dropdown when input is empty */
  showHistory?: boolean;
  /** Show Apply/Finish button in dropdown header */
  showApplyButton?: boolean;
  /** Extra CSS class on root */
  className?: string;
  /** Custom submit button icon (inline SVG markup, sanitized). Defaults to a send icon. */
  submitIcon?: string;
  /** Accent color for focus ring, submit button, staged chips and status (any CSS color). Default teal `#0f766e`. */
  color?: string;
  /** Darker accent variant for hover states. Defaults to a derived shade of `color`. */
  colorDark?: string;
  /** Border radius of the main input bar (any CSS radius or px number). Default `24px`. */
  borderRadius?: string | number;
  /** Enterprise design tokens (theme / density / direction / height) */
  tokens?: DesignTokens;
  /** Native form integration — renders a hidden input so the query submits with <form> */
  name?: string;
  /** Separator used for the hidden form value when staged items exist (default ', ') */
  formJoin?: string;
  /** Enable verbose console logging (default false) */
  debug?: boolean;
  /** Custom logger (defaults to console when debug, no-op otherwise) */
  logger?: Logger;
  /** English locale overrides */
  locale?: LocaleStrings;
  /** Callback on submit (Enter on input / Send button / history click) */
  onSubmit?: (query: string) => void;
  /** Callback on every input change */
  onChange?: (query: string) => void;
  /** Callback when staged multi-select changes */
  onStageChange?: (staged: Array<SuggestionItem<T>>) => void;
  /** Callback on focus */
  onFocus?: () => void;
  /** Callback on blur */
  onBlur?: () => void;
  /** Callback when instance is ready */
  onReady?: (instance: AutocompleteInstance<T>) => void;
  /** Enterprise telemetry hooks */
  telemetry?: TelemetryEvents;
  /** Fired when async dataSource rejects (also routed to telemetry.onError) */
  onAsyncError?: (err: unknown) => void;
}

export interface AutocompleteInstance<T = unknown> {
  getQuery(): string;
  /** Alias of getQuery() — plain text content (parity with rich-editor getText) */
  getText(): string;
  /** Value serialized for native <form> (query + staged labels joined) */
  getFormValue(): string;
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
  /** Re-run the current query against the async dataSource (no-op for sync) */
  reload(): void;
  /** True while an async dataSource request is in flight */
  isLoading(): boolean;
  getStaged(): Array<SuggestionItem<T>>;
  clearStaged(): void;
  getHistory(): string[];
  clearHistory(): void;
  setItems(items: Array<SuggestionItem<T>>): void;
  getItems(): Array<SuggestionItem<T>>;
  setGroups(groups: GroupConfig[]): void;
  enable(): void;
  disable(): void;
  isDisabled(): boolean;
  /** Switch dropdown direction at runtime */
  setDropup(v: boolean): void;
  /** Update main input border radius at runtime (any CSS radius or px number) */
  setBorderRadius(v: string | number): void;
  /** Update accent theme at runtime */
  setTheme(accent: string, dark?: string): void;
  getElement(): HTMLElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: 'submit' | 'change' | 'stage' | 'focus' | 'blur', handler: (...args: any[]) => void): () => void;
  destroy(): void;
}
