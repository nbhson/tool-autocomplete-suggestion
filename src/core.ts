import {
  applySuggestion,
  getGroupedMetadata,
  isItemInQuery,
  removeAccents,
} from './matching';
import { escapeAttr, escapeHTML } from './sanitizer';
import { sanitizeSvgMarkup } from './icons';
import { getActiveHighlightRange, getQueryWordForSuggestions } from './highlight';
import { DEFAULT_GROUPS, DEFAULT_ITEMS } from './default-data';
import { themeForGroup } from './themes';
import { debounce, QueryCache } from './async';
import { createMemoryHistory } from './history';
import { resolveLogger } from './logger';
import { resolveGroupOrder, toggleStaged, serializeFormValue } from './store';
import { createHiddenInput } from './form';
import type {
  AutocompleteInstance,
  AutocompleteOptions,
  GroupedItem,
  HighlightRange,
  LocaleStrings,
  SuggestionItem,
} from './types';

const DEFAULT_LOCALE: Required<LocaleStrings> = {
  recentTitle: 'Recent searches',
  searchPlaceholder: 'Search by keyword...',
  clearTitle: 'Clear',
  submitTitle: 'Search',
  selected: 'Selected',
  items: 'items',
  apply: 'Apply',
  done: 'Done',
  scope: 'scope',
  tier: 'tier',
  hits: 'hits',
  in: 'in',
  groups: 'groups',
  replacing: 'replacing',
  hintBrowse: 'Browse',
  hintMulti: 'multi-select',
  hintApply: 'apply',
  noResults: 'No matches',
  loading: 'Loading…',
  loadError: 'Could not load suggestions',
  retry: 'Retry',
  empty: 'No matches — try another keyword',
  showMore: 'showing',
};

function esc(s: string): string {
  return escapeHTML(s);
}

function renderHighlightedLabel(label: string, query: string, isFocused: boolean): string {
  if (!query) return esc(label);
  const normLabel = removeAccents(label);
  const normQuery = removeAccents(query);
  const matchStart = normLabel.indexOf(normQuery);
  if (matchStart === -1) return esc(label);
  const before = esc(label.slice(0, matchStart));
  const matched = esc(label.slice(matchStart, matchStart + normQuery.length));
  const after = esc(label.slice(matchStart + normQuery.length));
  const cls = isFocused ? 'sa-match sa-match-focused' : 'sa-match';
  return `${before}<span class="${cls}">${matched}</span>${after}`;
}

export const DEFAULT_SUBMIT_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';

let instanceCounter = 0;

export function createAutocomplete<T = unknown>(options: AutocompleteOptions<T>): AutocompleteInstance<T> {
  const containerEl: HTMLElement | null =
    typeof options.container === 'string'
      ? (document.querySelector(options.container) as HTMLElement | null)
      : options.container;
  if (!containerEl) throw new Error('[sautocomplete] container not found');

  const locale = { ...DEFAULT_LOCALE, ...(options.locale ?? {}) };
  const logger = resolveLogger(!!options.debug, options.logger);
  const formJoin = options.formJoin ?? ', ';

  let items: Array<SuggestionItem<T>> = [...(options.items ?? (DEFAULT_ITEMS as Array<SuggestionItem<T>>))];
  let groupOrder: string[] = resolveGroupOrder(
    items as Array<SuggestionItem<unknown>>,
    options.groups,
    options.groupOrder,
  );
  const groupIconByName = new Map<string, string>();
  const indexGroupIcons = (groups: { name: string; icon?: string }[] | undefined) => {
    groupIconByName.clear();
    for (const g of groups ?? []) {
      if (g.icon) {
        const safe = sanitizeSvgMarkup(g.icon);
        if (safe) groupIconByName.set(g.name, safe);
        else logger.warn(`Dropping unsafe icon for group "${g.name}"`);
      }
    }
  };
  indexGroupIcons(options.groups ?? DEFAULT_GROUPS);

  let dropup = !!options.dropup;
  let disabled = !!options.disabled;
  const minChars = options.minChars ?? 1;
  const maxHistory = options.maxHistory ?? 5;
  const maxItemsPerGroup = options.maxItemsPerGroup ?? 0;
  const maxTotalItems = options.maxTotalItems ?? 0;
  const virtualizeThreshold = options.virtualizeThreshold ?? 200;
  const exactMatch = (options.matchMode ?? 'accent-insensitive') === 'exact';
  const showStatusBar = options.showStatusBar ?? true;
  const showHistory = options.showHistory ?? true;
  const showApplyButton = options.showApplyButton ?? true;

  // ---------- async data source ----------
  const dataSource = options.dataSource;
  const debounceMs = options.debounceMs ?? 200;
  const useCache = options.asyncCache ?? true;
  const cache = new QueryCache<SuggestionItem<T>>(50);
  let asyncItems: Array<SuggestionItem<T>> | null = null;
  let asyncLoading = false;
  let asyncError: unknown = null;
  let requestId = 0;
  let aborter: AbortController | null = null;

  // ---------- history (pluggable adapter) ----------
  const memHistory = createMemoryHistory(options.history ?? [], maxHistory);
  let history: string[] = memHistory.get();
  const historyAdapter = options.historyAdapter;
  if (historyAdapter) {
    try {
      const loaded = historyAdapter.load();
      if (loaded instanceof Promise) {
        loaded.then(
          (h) => {
            history = memHistory.setAll(h);
            render();
          },
          (err) => logger.warn('historyAdapter.load() rejected', err),
        );
      } else if (Array.isArray(loaded)) {
        history = memHistory.setAll(loaded);
      }
    } catch (err) {
      logger.warn('historyAdapter.load() threw', err);
    }
  }

  let input = options.value ?? '';
  let cursorPos = input.length;
  let isOpen = false;
  let isChipJustSelected = false;
  let focusedIndex = -1;
  let staged: Array<GroupedItem<T>> = [];
  let selectedLabels: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: Record<string, Array<(...args: any[]) => void>> = {
    submit: [], change: [], stage: [], focus: [], blur: [],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit = (evt: string, ...args: any[]) => {
    listeners[evt]?.forEach((fn) => fn(...args));
    if (evt === 'submit') options.onSubmit?.(args[0]);
    if (evt === 'change') options.onChange?.(args[0]);
    if (evt === 'stage') (options.onStageChange as ((s: Array<SuggestionItem<T>>) => void) | undefined)?.(args[0]);
    if (evt === 'focus') options.onFocus?.();
    if (evt === 'blur') options.onBlur?.();
  };
  const reportError = (err: unknown) => {
    options.onAsyncError?.(err);
    options.telemetry?.onError?.(err);
    logger.error(err);
  };

  // ---------- DOM ----------
  const uid = `sa${++instanceCounter}`;
  const listboxId = `${uid}-listbox`;
  const liveId = `${uid}-live`;
  const root = document.createElement('div');
  root.className = `sa-root${options.className ? ' ' + options.className : ''}${dropup ? ' sa-dropup' : ''}`;

  // Direction (RTL enterprise requirement)
  const resolvedDir = (() => {
    const d = options.tokens?.direction ?? 'auto';
    if (d === 'rtl') return 'rtl';
    if (d === 'ltr') return 'ltr';
    const docDir = typeof document !== 'undefined' ? document.documentElement?.dir : '';
    return docDir === 'rtl' ? 'rtl' : 'ltr';
  })();
  root.setAttribute('dir', resolvedDir);
  if (resolvedDir === 'rtl') root.classList.add('sa-rtl');
  if (options.tokens?.theme === 'dark') root.setAttribute('data-sa-theme', 'dark');
  if (options.tokens?.theme === 'light') root.setAttribute('data-sa-theme', 'light');
  if (options.tokens?.density) root.setAttribute('data-sa-density', options.tokens.density);
  if (options.tokens?.maxDropdownHeight !== undefined) {
    root.style.setProperty(
      '--sa-drop-max',
      typeof options.tokens.maxDropdownHeight === 'number'
        ? `${options.tokens.maxDropdownHeight}px`
        : options.tokens.maxDropdownHeight,
    );
  }
  // Extended design tokens (font / surfaces / panel) + cssVars escape hatch
  {
    const t = options.tokens;
    const px = (v: string | number): string => (typeof v === 'number' ? `${v}px` : v);
    if (t?.fontFamily) root.style.setProperty('--sa-font', t.fontFamily);
    if (t?.fontSize !== undefined) root.style.setProperty('--sa-font-size', px(t.fontSize));
    if (t?.background) root.style.setProperty('--sa-bg', t.background);
    if (t?.foreground) root.style.setProperty('--sa-fg', t.foreground);
    if (t?.borderColor) root.style.setProperty('--sa-border', t.borderColor);
    if (t?.mutedColor) root.style.setProperty('--sa-muted', t.mutedColor);
    if (t?.dropdownRadius !== undefined) root.style.setProperty('--sa-drop-radius', px(t.dropdownRadius));
    if (t?.shadow) root.style.setProperty('--sa-shadow', t.shadow);
    if (t?.cssVars) {
      for (const [k, v] of Object.entries(t.cssVars)) {
        if (!k || v === undefined) continue;
        const name = k.startsWith('--') ? k : `--${k}`;
        if (!/^--[a-zA-Z0-9-_]+$/.test(name)) {
          logger.warn(`Ignoring invalid cssVar "${k}" (must be a CSS custom property name)`);
          continue;
        }
        root.style.setProperty(name, v);
      }
    }
  }

  const safeSubmitIcon = (() => {
    if (!options.submitIcon) return DEFAULT_SUBMIT_ICON;
    const safe = sanitizeSvgMarkup(options.submitIcon);
    if (!safe) logger.warn('Dropping unsafe submitIcon markup');
    return safe || DEFAULT_SUBMIT_ICON;
  })();

  root.innerHTML = `
    <div class="sa-bar" data-sa="bar">
      <span class="sa-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </span>
      <div class="sa-field">
        <div class="sa-underlay" data-sa="underlay" aria-hidden="true"></div>
        <input class="sa-input" data-sa="input" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="${listboxId}" aria-autocomplete="list" aria-describedby="${liveId}" aria-label="${escapeAttr(options.placeholder ?? locale.searchPlaceholder)}" />
      </div>
      <button class="sa-clear" data-sa="clear" type="button" aria-label="${escapeAttr(locale.clearTitle)}" hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <button class="sa-submit" data-sa="submit" type="button" aria-label="${escapeAttr(locale.submitTitle)}" disabled>
        ${safeSubmitIcon}
      </button>
    </div>
    <div class="sa-dropdown" data-sa="dropdown" role="listbox" id="${listboxId}" aria-label="${escapeAttr(locale.searchPlaceholder)}" hidden></div>
    <div class="sa-sr" data-sa="live" id="${liveId}" role="status" aria-live="polite"></div>
  `;

  const barEl = root.querySelector('[data-sa="bar"]') as HTMLDivElement;
  const underlayEl = root.querySelector('[data-sa="underlay"]') as HTMLDivElement;
  const inputEl = root.querySelector('[data-sa="input"]') as HTMLInputElement;
  const clearEl = root.querySelector('[data-sa="clear"]') as HTMLButtonElement;
  const submitEl = root.querySelector('[data-sa="submit"]') as HTMLButtonElement;
  const dropdownEl = root.querySelector('[data-sa="dropdown"]') as HTMLDivElement;
  const liveEl = root.querySelector('[data-sa="live"]') as HTMLDivElement;

  // Native form integration
  let hiddenInput: HTMLInputElement | null = null;
  if (options.name) {
    hiddenInput = createHiddenInput(options.name, input);
    root.appendChild(hiddenInput);
  }
  const syncHidden = () => {
    if (hiddenInput) hiddenInput.value = serializeFormValue(input, staged.map((s) => s.label), formJoin);
  };

  inputEl.placeholder = options.placeholder ?? locale.searchPlaceholder;
  inputEl.value = input;
  clearEl.title = locale.clearTitle;
  submitEl.title = locale.submitTitle;
  if (options.color) root.style.setProperty('--sa-accent', options.color);
  if (options.colorDark) root.style.setProperty('--sa-accent-dark', options.colorDark);
  const applyBorderRadius = (v: string | number | undefined) => {
    if (v === undefined) return;
    root.style.setProperty('--sa-radius', typeof v === 'number' ? `${v}px` : v);
  };
  applyBorderRadius(options.borderRadius);

  containerEl.appendChild(root);
  if (disabled) {
    inputEl.disabled = true;
    root.classList.add('sa-disabled');
  }

  const effectiveItems = (): Array<SuggestionItem<T>> =>
    dataSource && asyncItems !== null ? asyncItems : items;

  const knownLabels = (): string[] =>
    Array.from(new Set([...items.map((i) => i.label), ...(asyncItems ?? []).map((i) => i.label), ...selectedLabels]));

  const activeRange = (): HighlightRange | null =>
    getActiveHighlightRange(input, cursorPos, knownLabels());

  const queryWord = (range: HighlightRange | null): string =>
    getQueryWordForSuggestions(input, range);

  function announce(msg: string) {
    liveEl.textContent = msg;
  }

  function syncUnderlayScroll() {
    underlayEl.scrollLeft = inputEl.scrollLeft;
  }

  function renderUnderlay(range: HighlightRange | null) {
    if (range) {
      underlayEl.innerHTML =
        `<span class="sa-dim">${esc(input.slice(0, range.start))}</span>` +
        `<span class="sa-hl">${esc(input.slice(range.start, range.end))}</span>` +
        `<span class="sa-dim">${esc(input.slice(range.end))}</span>`;
    } else {
      underlayEl.textContent = input;
    }
  }

  function setInputValue(v: string, moveCursorToEnd = false) {
    input = v;
    inputEl.value = v;
    if (moveCursorToEnd) {
      cursorPos = v.length;
      try { inputEl.setSelectionRange(cursorPos, cursorPos); } catch { /* noop */ }
    }
    syncHidden();
    refreshChrome();
  }

  function refreshChrome() {
    const hasText = input.trim().length > 0;
    clearEl.hidden = !hasText;
    submitEl.disabled = !hasText || disabled;
    submitEl.classList.toggle('sa-submit-active', hasText && !disabled);
  }

  function pushHistory(q: string) {
    const t = q.trim();
    if (!t || maxHistory <= 0) return;
    history = memHistory.push(t);
    try {
      void historyAdapter?.save(history);
    } catch (err) {
      logger.warn('historyAdapter.save() threw', err);
    }
  }

  function doSubmit(overrideQuery?: string) {
    const finalQuery = (overrideQuery !== undefined ? overrideQuery : input).replace(/,\s*$/, '').trim();
    if (finalQuery) pushHistory(finalQuery);
    staged = [];
    emit('stage', [...staged]);
    isOpen = false;
    focusedIndex = -1;
    isChipJustSelected = true;
    syncHidden();
    render();
    emit('submit', finalQuery);
  }

  function toggleStage(item: GroupedItem<T>) {
    if (item.disabled) return;
    staged = toggleStaged(staged, item);
    emit('stage', [...staged]);
    isOpen = true;
    isChipJustSelected = false;
    syncHidden();
    render();
  }

  function commitStaged() {
    if (staged.length === 0) return;
    const range = activeRange();
    const qWord = queryWord(range);
    const labels = staged.map((s) => s.label);
    options.telemetry?.onSelect?.(staged[0] as SuggestionItem<unknown>);
    selectedLabels = Array.from(new Set([...selectedLabels, ...labels]));
    const combined = labels.join(', ');
    let updated: string;
    if (range && !range.isEntity) {
      const before = input.slice(0, range.start);
      const after = input.slice(range.end);
      updated = before + combined + (after ? after : '');
    } else {
      const trimmed = input.replace(/,\s*$/, '').trim();
      const lastWord = trimmed.split(/\s+/).pop() || '';
      if (lastWord && qWord && lastWord.toLowerCase().startsWith(qWord.toLowerCase())) {
        const withoutLast = trimmed.slice(0, trimmed.length - lastWord.length).trim();
        updated = withoutLast ? `${withoutLast} ${combined}` : combined;
      } else {
        updated = trimmed ? `${trimmed}, ${combined}` : combined;
      }
    }
    setInputValue(updated, true);
    staged = [];
    emit('stage', [...staged]);
    isOpen = false;
    focusedIndex = -1;
    isChipJustSelected = true;
    inputEl.focus();
    syncHidden();
    render();
    emit('change', updated);
  }

  function selectSingle(item: GroupedItem<T>) {
    if (item.disabled) return;
    options.telemetry?.onSelect?.(item as SuggestionItem<unknown>);
    selectedLabels = Array.from(new Set([...selectedLabels, item.label]));
    const range = activeRange();
    let updated: string;
    if (range && !range.isEntity) {
      const before = input.slice(0, range.start);
      const after = input.slice(range.end);
      updated = before + item.label + (after ? after : ' ');
    } else {
      updated = applySuggestion(input, item.label);
    }
    setInputValue(updated, true);
    staged = [];
    emit('stage', [...staged]);
    isChipJustSelected = true;
    focusedIndex = -1;
    isOpen = false;
    inputEl.focus();
    syncHidden();
    render();
    emit('change', updated);
  }

  // ---------- async fetch ----------
  const debouncedFetch = debounce((qWord: string, full: string) => {
    void fetchAsync(qWord, full);
  }, debounceMs);

  async function fetchAsync(qWord: string, full: string): Promise<void> {
    if (!dataSource) return;
    if (qWord.length < minChars) {
      asyncItems = null;
      asyncLoading = false;
      asyncError = null;
      render();
      return;
    }
    if (useCache) {
      const cached = cache.get(qWord.toLowerCase());
      if (cached) {
        asyncItems = cached;
        asyncLoading = false;
        asyncError = null;
        logger.debug('async cache hit', qWord);
        render();
        return;
      }
    }
    aborter?.abort();
    aborter = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const myId = ++requestId;
    const signal = aborter?.signal as AbortSignal | undefined;
    asyncLoading = true;
    asyncError = null;
    render();
    const t0 = performance.now();
    try {
      const result = await dataSource({
        query: qWord,
        fullQuery: full,
        signal: signal ?? ({ aborted: false } as unknown as AbortSignal),
      });
      if (myId !== requestId) return; // stale
      asyncItems = [...result];
      if (useCache) cache.set(qWord.toLowerCase(), asyncItems);
      asyncLoading = false;
      focusedIndex = -1;
      const ms = performance.now() - t0;
      logger.debug('async resolved', { qWord, hits: asyncItems.length, ms: ms.toFixed(1) });
      render();
    } catch (err) {
      if (myId !== requestId) return;
      const aborted =
        (err as { name?: string })?.name === 'AbortError' || (signal?.aborted ?? false);
      if (aborted) return;
      asyncLoading = false;
      asyncError = err;
      reportError(err);
      render();
    }
  }

  function scheduleQuery() {
    if (!dataSource) {
      render();
      return;
    }
    const range = activeRange();
    const qWord = queryWord(range);
    if (qWord.length < minChars) {
      debouncedFetch.cancel();
      aborter?.abort();
      asyncItems = null;
      asyncLoading = false;
      asyncError = null;
      render();
      return;
    }
    if (debounceMs <= 0) {
      void fetchAsync(qWord, input);
    } else {
      debouncedFetch.run(qWord, input);
    }
  }

  // Last grouped result is cached for keyboard nav without recompute
  let lastGrouped: { groups: { type: string; items: Array<GroupedItem<T>> }[]; allItems: Array<GroupedItem<T>>; totalHits: number } = {
    groups: [],
    allItems: [],
    totalHits: 0,
  };

  function moveFocus(delta: number) {
    const total = lastGrouped.totalHits;
    if (total === 0) return;
    const next = focusedIndex < 0 ? (delta > 0 ? 0 : total - 1) : (focusedIndex + delta + total) % total;
    updateFocusUI(focusedIndex, next);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isChipJustSelected && e.key !== 'Tab' && e.key !== 'Enter' && e.key !== 'Escape') {
      isChipJustSelected = false;
    }
    const range = activeRange();
    const qWord = queryWord(range);
    const grouped =
      dataSource && asyncItems !== null
        ? getGroupedMetadata(asyncItems as Array<SuggestionItem<unknown>>, qWord, {
            groupOrder,
            maxItemsPerGroup,
            maxTotalItems,
            exact: exactMatch,
          }) as unknown as typeof lastGrouped
        : qWord.length >= minChars
          ? (getGroupedMetadata(items as Array<SuggestionItem<unknown>>, qWord, {
              groupOrder,
              maxItemsPerGroup,
              maxTotalItems,
              exact: exactMatch,
            }) as unknown as typeof lastGrouped)
          : { groups: [], allItems: [], totalHits: 0 };
    const totalHits = grouped.totalHits;
    const allItems = grouped.allItems;

    if (e.key === 'Tab') {
      if (isOpen && !isChipJustSelected && totalHits > 0) {
        e.preventDefault();
        const next = e.shiftKey
          ? (focusedIndex <= 0 ? totalHits - 1 : focusedIndex - 1)
          : (focusedIndex === -1 || focusedIndex >= totalHits - 1 ? 0 : focusedIndex + 1);
        updateFocusUI(focusedIndex, next);
        return;
      }
    }
    if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < allItems.length && isOpen) {
      e.preventDefault();
      toggleStage(allItems[focusedIndex]);
      const next = (focusedIndex + 1) % totalHits;
      updateFocusUI(focusedIndex, next);
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && isOpen && focusedIndex >= 0) {
      e.preventDefault();
      updateFocusUI(focusedIndex, (focusedIndex + 1) % totalHits);
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && isOpen && focusedIndex >= 0) {
      e.preventDefault();
      updateFocusUI(focusedIndex, focusedIndex <= 0 ? totalHits - 1 : focusedIndex - 1);
      return;
    }
    // Enterprise full keyboard support
    if (e.key === 'Home' && isOpen && totalHits > 0) {
      e.preventDefault();
      updateFocusUI(focusedIndex, 0);
      return;
    }
    if (e.key === 'End' && isOpen && totalHits > 0) {
      e.preventDefault();
      updateFocusUI(focusedIndex, totalHits - 1);
      return;
    }
    if (e.key === 'PageDown' && isOpen && totalHits > 0) {
      e.preventDefault();
      moveFocus(5);
      return;
    }
    if (e.key === 'PageUp' && isOpen && totalHits > 0) {
      e.preventDefault();
      moveFocus(-5);
      return;
    }
    if (e.key === 'Escape') {
      if (focusedIndex >= 0) { updateFocusUI(focusedIndex, -1); return; }
      staged = [];
      emit('stage', [...staged]);
      isOpen = false;
      syncHidden();
      render();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (staged.length > 0) { commitStaged(); return; }
      if (focusedIndex >= 0 && focusedIndex < allItems.length && isOpen) {
        selectSingle(allItems[focusedIndex]);
        return;
      }
      doSubmit();
    }
  }

  function scrollFocusedIntoView() {
    const el = dropdownEl.querySelector(`[data-gi="${focusedIndex}"]`) as HTMLElement | null;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    }
  }

  function updateFocusUI(prevIndex: number, nextIndex: number) {
    if (prevIndex === nextIndex) return;
    const prevEl = prevIndex >= 0
      ? dropdownEl.querySelector(`[data-gi="${prevIndex}"]`) as HTMLElement | null
      : null;
    const nextEl = nextIndex >= 0
      ? dropdownEl.querySelector(`[data-gi="${nextIndex}"]`) as HTMLElement | null
      : null;
    prevEl?.classList.remove('sa-chip-focused');
    prevEl?.setAttribute('aria-selected', prevEl?.hasAttribute('data-staged') ? 'true' : 'false');
    prevEl?.querySelector('.sa-match-focused')?.classList.remove('sa-match-focused');
    prevEl?.querySelector('.sa-keys')?.remove();
    if (nextEl) {
      nextEl.classList.add('sa-chip-focused');
      nextEl.setAttribute('aria-selected', 'true');
      nextEl.querySelector('.sa-match')?.classList.add('sa-match-focused');
      if (!nextEl.querySelector('.sa-keys')) {
        const keys = document.createElement('span');
        keys.className = 'sa-keys';
        keys.setAttribute('aria-hidden', 'true');
        keys.innerHTML = '<span>Space</span><span>↵</span>';
        nextEl.appendChild(keys);
      }
    }
    focusedIndex = nextIndex;
    syncAria();
    if (nextIndex >= 0) scrollFocusedIntoView();
  }

  function syncAria() {
    const expanded = !dropdownEl.hidden;
    inputEl.setAttribute('aria-expanded', String(expanded));
    if (expanded && focusedIndex >= 0) {
      inputEl.setAttribute('aria-activedescendant', `${uid}-opt-${focusedIndex}`);
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }
  }

  function render() {
    refreshChrome();
    syncHidden();
    const range = activeRange();
    renderUnderlay(range);
    syncUnderlayScroll();
    const wasOpen = !dropdownEl.hidden && dropdownEl.innerHTML !== '';
    const prevScroll = dropdownEl.querySelector('.sa-groups')?.scrollTop ?? 0;

    if (!isOpen || disabled) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
      announce('');
      syncAria();
      return;
    }

    const trimmed = input.trim();
    const showRecent = showHistory && trimmed === '' && history.length > 0 && maxHistory > 0;

    if (showRecent) {
      dropdownEl.hidden = false;
      dropdownEl.innerHTML = `
        <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
          <div class="sa-panel-title">${esc(locale.recentTitle)}</div>
          ${history.map((h, i) => `
            <button type="button" class="sa-history" role="option" aria-selected="false" data-h="${i}">
              <span class="sa-history-ic" aria-hidden="true">◷</span><span>${esc(h)}</span>
            </button>`).join('')}
        </div>`;
      announce(`${history.length} recent searches`);
      dropdownEl.querySelectorAll('[data-h]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const h = history[Number((btn as HTMLElement).dataset.h)];
          setInputValue(h, true);
          doSubmit(h);
        });
      });
      syncAria();
      return;
    }

    // Async loading / error states (take precedence over sync filtering)
    if (dataSource && asyncLoading) {
      dropdownEl.hidden = false;
      dropdownEl.innerHTML = `
        <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
          <div class="sa-loading" role="status" aria-live="polite">
            <span class="sa-spinner" aria-hidden="true"></span><span>${esc(locale.loading ?? 'Loading…')}</span>
          </div>
        </div>`;
      announce(locale.loading ?? 'Loading');
      syncAria();
      return;
    }
    if (dataSource && asyncError) {
      dropdownEl.hidden = false;
      dropdownEl.innerHTML = `
        <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
          <div class="sa-error" role="alert">
            <span>${esc(locale.loadError ?? 'Could not load suggestions')}</span>
            <button type="button" class="sa-retry" data-sa="retry">${esc(locale.retry ?? 'Retry')}</button>
          </div>
        </div>`;
      announce(locale.loadError ?? 'Error');
      dropdownEl.querySelector('[data-sa="retry"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        instance.reload();
      });
      syncAria();
      return;
    }

    const qWord = queryWord(range);
    if (qWord.length < minChars || isChipJustSelected) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
      announce('');
      syncAria();
      return;
    }

    const t0 = performance.now();
    const sourceItems = effectiveItems();
    const grouped = getGroupedMetadata(sourceItems as Array<SuggestionItem<unknown>>, qWord, {
      groupOrder,
      maxItemsPerGroup,
      maxTotalItems,
      exact: exactMatch,
    }) as unknown as typeof lastGrouped;
    const ms = performance.now() - t0;
    lastGrouped = grouped;

    // Sync zero-hit keeps legacy hidden behavior (e2e contract).
    // Async zero-hit renders an explicit empty state for enterprise UX.
    if (grouped.totalHits === 0) {
      if (dataSource && asyncItems !== null && !asyncLoading && !asyncError) {
        dropdownEl.hidden = false;
        dropdownEl.innerHTML = `
          <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
            <div class="sa-empty" role="status">${esc(locale.empty ?? locale.noResults)}</div>
          </div>`;
        announce(locale.empty ?? locale.noResults);
        syncAria();
        return;
      }
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
      announce(locale.noResults);
      syncAria();
      return;
    }

    options.telemetry?.onSearch?.({
      query: qWord,
      hits: grouped.totalHits,
      groups: grouped.groups.length,
      elapsedMs: ms,
      source: dataSource ? (asyncItems !== null ? 'async' : 'sync') : 'sync',
    });

    // Virtualization: cap rendered nodes, preserve group structure
    const threshold = Math.max(0, virtualizeThreshold);
    const truncated = threshold > 0 && grouped.allItems.length > threshold;
    const visibleSet = truncated
      ? new Set(grouped.allItems.slice(0, threshold).map((a) => a.globalIndex))
      : null;
    const visibleGroups = truncated
      ? grouped.groups
          .map((g) => ({ type: g.type, items: g.items.filter((it) => visibleSet!.has(it.globalIndex)) }))
          .filter((g) => g.items.length > 0)
      : grouped.groups;

    const stagedCount = staged.length;
    dropdownEl.hidden = false;
    dropdownEl.innerHTML = `
      <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
        ${showStatusBar ? `
        <div class="sa-status" role="status" aria-live="polite">
          <div class="sa-status-left">
            <span class="sa-meta">${esc(locale.scope)} <b>ALL</b></span>
            <span class="sa-meta">${esc(locale.hits)} <b>${grouped.totalHits}</b> ${esc(locale.in)} <b>${grouped.groups.length} ${esc(locale.groups)}</b></span>
            ${qWord ? `<span class="sa-meta">${esc(locale.replacing)} <span class="sa-replacing">${esc(qWord)}</span></span>` : ''}
            ${stagedCount > 0 ? `<span class="sa-staged">✓ ${esc(locale.selected)}: ${stagedCount}</span>` : ''}
          </div>
          <div class="sa-status-right">
            ${stagedCount === 0 ? `
              <span class="sa-hint"><kbd>Tab</kbd> ${esc(locale.hintBrowse)} • <kbd>Space</kbd> ${esc(locale.hintMulti)} • <kbd>Enter ↵</kbd> ${esc(locale.hintApply)}</span>
            ` : ''}
            ${showApplyButton ? `<button type="button" class="sa-apply${stagedCount > 0 ? ' sa-apply-active' : ''}" data-sa="apply">✓ ${stagedCount > 0 ? `${esc(locale.apply)} (${stagedCount}) Enter ↵` : esc(locale.done) + ' ↵'}</button>` : ''}
          </div>
        </div>` : ''}
        <div class="sa-groups">
          ${visibleGroups.map((g) => {
            const th = themeForGroup(g.type);
            const icon = groupIconByName.get(g.type);
            return `
            <div class="sa-group" role="group" aria-label="${escapeAttr(g.type)}">
              <div class="sa-group-badge" style="background:${th.bg};color:${th.text};border-color:${th.border}">
                ${icon ? `<span class="sa-group-icon" aria-hidden="true">${icon}</span>` : `<span class="sa-dot" style="background:${th.dot}" aria-hidden="true"></span>`}
                <span>${esc(g.type)}</span>
                <span class="sa-count">${g.items.length}</span>
              </div>
              <div class="sa-chips">
                ${g.items.map((item) => {
                  const isFocused = focusedIndex === item.globalIndex;
                  const isStaged = staged.some((s) => s.id === item.id || s.label.toLowerCase() === item.label.toLowerCase());
                  const inQuery = isItemInQuery(input, item.label);
                  const selected = isStaged || inQuery;
                  const cls = ['sa-chip'];
                  if (isFocused) cls.push('sa-chip-focused');
                  if (isStaged) cls.push('sa-chip-staged');
                  else if (inQuery) cls.push('sa-chip-inquery');
                  return `<button type="button" role="option" id="${uid}-opt-${item.globalIndex}" aria-selected="${selected}"${isStaged ? ' data-staged="true"' : ''}${item.disabled ? ' aria-disabled="true" disabled' : ''} class="${cls.join(' ')}" data-gi="${item.globalIndex}" data-id="${escapeAttr(item.id)}" aria-label="${escapeAttr(item.label)}" title="${esc(item.label)}">${isStaged || inQuery ? '<span class="sa-tick" aria-hidden="true">✓</span>' : ''}<span>${renderHighlightedLabel(item.label, qWord, isFocused)}</span>${isFocused ? '<span class="sa-keys" aria-hidden="true"><span>Space</span><span>↵</span></span>' : ''}</button>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
        ${truncated ? `<div class="sa-more" role="status">${esc(locale.showMore ?? 'showing')} <b>${threshold}</b> / <b>${grouped.totalHits}</b></div>` : ''}
      </div>`;

    announce(`${grouped.totalHits} hits in ${grouped.groups.length} groups`);
    dropdownEl.querySelector('[data-sa="apply"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      commitStaged();
    });
    dropdownEl.querySelectorAll('.sa-chip').forEach((chip) => {
      const gi = Number((chip as HTMLElement).dataset.gi);
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const found = grouped.allItems.find((a) => a.globalIndex === gi);
        if (found) toggleStage(found);
      });
      chip.addEventListener('mouseenter', () => {
        if (focusedIndex !== gi) updateFocusUI(focusedIndex, gi);
      });
    });
    const groupsEl = dropdownEl.querySelector('.sa-groups') as HTMLElement | null;
    if (groupsEl && prevScroll > 0) groupsEl.scrollTop = prevScroll;
    syncAria();
  }

  // ---------- events ----------
  inputEl.addEventListener('input', () => {
    input = inputEl.value;
    cursorPos = inputEl.selectionStart ?? input.length;
    if (input.trim() === '') {
      staged = [];
      emit('stage', [...staged]);
      focusedIndex = -1;
    }
    isOpen = true;
    isChipJustSelected = false;
    if (dataSource) scheduleQuery();
    else render();
    syncHidden();
    emit('change', input);
  });
  inputEl.addEventListener('keydown', handleKeyDown);
  inputEl.addEventListener('keyup', () => {
    cursorPos = inputEl.selectionStart ?? inputEl.value.length;
    renderUnderlay(activeRange());
    syncUnderlayScroll();
  });
  inputEl.addEventListener('click', () => {
    cursorPos = inputEl.selectionStart ?? inputEl.value.length;
    isOpen = true;
    render();
    syncUnderlayScroll();
  });
  inputEl.addEventListener('select', () => {
    cursorPos = inputEl.selectionStart ?? inputEl.value.length;
    syncUnderlayScroll();
  });
  inputEl.addEventListener('scroll', syncUnderlayScroll);
  inputEl.addEventListener('focus', () => {
    cursorPos = inputEl.selectionStart ?? inputEl.value.length;
    isOpen = true;
    isChipJustSelected = false;
    render();
    syncUnderlayScroll();
    emit('focus');
  });
  inputEl.addEventListener('blur', () => { emit('blur'); });

  barEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    inputEl.focus();
  });
  clearEl.addEventListener('click', (e) => {
    e.stopPropagation();
    setInputValue('', false);
    cursorPos = 0;
    staged = [];
    emit('stage', [...staged]);
    focusedIndex = -1;
    isChipJustSelected = false;
    asyncItems = dataSource ? null : asyncItems;
    asyncError = null;
    inputEl.focus();
    render();
    emit('change', '');
  });
  submitEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!submitEl.disabled) doSubmit();
  });

  const onDocDown = (e: MouseEvent) => {
    if (!root.contains(e.target as Node)) {
      isOpen = false;
      focusedIndex = -1;
      debouncedFetch.cancel();
      render();
    }
  };
  document.addEventListener('mousedown', onDocDown);

  // init
  refreshChrome();
  syncHidden();
  renderUnderlay(activeRange());

  const instance: AutocompleteInstance<T> = {
    getQuery: () => inputEl.value,
    getText: () => inputEl.value,
    getFormValue: () => serializeFormValue(inputEl.value, staged.map((s) => s.label), formJoin),
    isEmpty: () => inputEl.value.trim().length === 0,
    getCharacterCount: () => inputEl.value.length,
    getWordCount: () => {
      const t = inputEl.value.trim();
      return t === '' ? 0 : t.split(/\s+/).length;
    },
    setQuery: (v, opts = {}) => {
      setInputValue(v, true);
      if (opts.open ?? true) isOpen = true;
      isChipJustSelected = false;
      if (v.trim() === '') {
        staged = [];
        emit('stage', [...staged]);
        focusedIndex = -1;
      }
      if (opts.focus ?? true) inputEl.focus();
      if (dataSource) {
        if (opts.open ?? true) void fetchAsync(queryWord(activeRange()), v);
        else render();
      } else {
        render();
      }
      emit('change', v);
    },
    clear: () => {
      setInputValue('', false);
      staged = [];
      emit('stage', [...staged]);
      focusedIndex = -1;
      asyncItems = dataSource ? null : asyncItems;
      asyncError = null;
      render();
      emit('change', '');
    },
    focus: () => { inputEl.focus(); isOpen = true; render(); },
    blur: () => inputEl.blur(),
    submit: (q) => doSubmit(q),
    reload: () => {
      if (!dataSource) {
        render();
        return;
      }
      asyncError = null;
      void fetchAsync(queryWord(activeRange()), input);
    },
    isLoading: () => asyncLoading,
    getStaged: () => [...staged],
    clearStaged: () => { staged = []; emit('stage', [...staged]); syncHidden(); render(); },
    getHistory: () => [...history],
    clearHistory: () => {
      history = memHistory.setAll([]);
      try {
        void historyAdapter?.clear();
      } catch (err) {
        logger.warn('historyAdapter.clear() threw', err);
      }
      render();
    },
    setItems: (next) => {
      items = [...next];
      cache.clear();
      if (!dataSource) asyncItems = null;
      focusedIndex = -1;
      render();
    },
    getItems: () => [...items],
    setGroups: (g) => {
      indexGroupIcons(g);
      groupOrder = resolveGroupOrder(
        items as Array<SuggestionItem<unknown>>,
        g,
        undefined,
      );
      focusedIndex = -1;
      render();
    },
    enable: () => { disabled = false; inputEl.disabled = false; root.classList.remove('sa-disabled'); refreshChrome(); },
    disable: () => { disabled = true; inputEl.disabled = true; root.classList.add('sa-disabled'); isOpen = false; render(); },
    isDisabled: () => disabled,
    setDropup: (v: boolean) => {
      dropup = v;
      root.classList.toggle('sa-dropup', v);
      render();
    },
    setBorderRadius: (v: string | number) => {
      applyBorderRadius(v);
    },
    setTheme: (accent: string, dark?: string) => {
      root.style.setProperty('--sa-accent', accent);
      if (dark) root.style.setProperty('--sa-accent-dark', dark);
    },
    getElement: () => root,
    on: (evt, handler) => {
      listeners[evt].push(handler);
      return () => {
        listeners[evt] = listeners[evt].filter((h) => h !== handler);
      };
    },
    destroy: () => {
      debouncedFetch.cancel();
      aborter?.abort();
      document.removeEventListener('mousedown', onDocDown);
      root.remove();
    },
  };

  options.onReady?.(instance);
  return instance;
}

export type { AutocompleteOptions, AutocompleteInstance };
