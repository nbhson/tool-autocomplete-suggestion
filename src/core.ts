import {
  applySuggestion,
  getGroupedMetadata,
  isItemInQuery,
  removeAccents,
} from './matching';
import { escapeAttr, escapeHTML } from './sanitizer';
import { getActiveHighlightRange, getQueryWordForSuggestions } from './highlight';
import { DEFAULT_GROUPS, DEFAULT_ITEMS } from './default-data';
import { themeForGroup } from './themes';
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

export function createAutocomplete(options: AutocompleteOptions): AutocompleteInstance {
  const containerEl: HTMLElement | null =
    typeof options.container === 'string'
      ? (document.querySelector(options.container) as HTMLElement | null)
      : options.container;
  if (!containerEl) throw new Error('[sautocomplete] container not found');

  const locale = { ...DEFAULT_LOCALE, ...(options.locale ?? {}) };
  let items: SuggestionItem[] = [...(options.items ?? DEFAULT_ITEMS)];
  let groupOrder: string[] = options.groupOrder ??
    (options.groups ?? DEFAULT_GROUPS).map((g) => g.name);
  if (groupOrder.length === 0) {
    groupOrder = Array.from(new Set(items.map((i) => i.group)));
  }
  let dropup = !!options.dropup;
  let disabled = !!options.disabled;
  const minChars = options.minChars ?? 1;
  const maxHistory = options.maxHistory ?? 5;
  const maxItemsPerGroup = options.maxItemsPerGroup ?? 0;
  const maxTotalItems = options.maxTotalItems ?? 0;
  const exactMatch = (options.matchMode ?? 'accent-insensitive') === 'exact';
  const showStatusBar = options.showStatusBar ?? true;
  const showHistory = options.showHistory ?? true;
  const showApplyButton = options.showApplyButton ?? true;

  let input = options.value ?? '';
  let cursorPos = input.length;
  let isOpen = false;
  let isChipJustSelected = false;
  let focusedIndex = -1;
  let staged: GroupedItem[] = [];
  let history: string[] = [...(options.history ?? [])].slice(0, Math.max(maxHistory, 0));
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
    if (evt === 'stage') options.onStageChange?.(args[0]);
    if (evt === 'focus') options.onFocus?.();
    if (evt === 'blur') options.onBlur?.();
  };

  // ---------- DOM ----------
  const uid = `sa${++instanceCounter}`;
  const listboxId = `${uid}-listbox`;
  const root = document.createElement('div');
  root.className = `sa-root${options.className ? ' ' + options.className : ''}${dropup ? ' sa-dropup' : ''}`;

  root.innerHTML = `
    <div class="sa-bar" data-sa="bar">
      <span class="sa-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </span>
      <div class="sa-field">
        <div class="sa-underlay" data-sa="underlay" aria-hidden="true"></div>
        <input class="sa-input" data-sa="input" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="${listboxId}" aria-autocomplete="list" aria-label="${escapeAttr(options.placeholder ?? locale.searchPlaceholder)}" />
      </div>
      <button class="sa-clear" data-sa="clear" type="button" aria-label="${escapeAttr(locale.clearTitle)}" hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <button class="sa-submit" data-sa="submit" type="button" aria-label="${escapeAttr(locale.submitTitle)}" disabled>
        ${options.submitIcon ?? DEFAULT_SUBMIT_ICON}
      </button>
    </div>
    <div class="sa-dropdown" data-sa="dropdown" role="listbox" id="${listboxId}" aria-label="${escapeAttr(locale.searchPlaceholder)}" hidden></div>
  `;

  const barEl = root.querySelector('[data-sa="bar"]') as HTMLDivElement;
  const underlayEl = root.querySelector('[data-sa="underlay"]') as HTMLDivElement;
  const inputEl = root.querySelector('[data-sa="input"]') as HTMLInputElement;
  const clearEl = root.querySelector('[data-sa="clear"]') as HTMLButtonElement;
  const submitEl = root.querySelector('[data-sa="submit"]') as HTMLButtonElement;
  const dropdownEl = root.querySelector('[data-sa="dropdown"]') as HTMLDivElement;

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

  const knownLabels = (): string[] =>
    Array.from(new Set([...items.map((i) => i.label), ...selectedLabels]));

  const activeRange = (): HighlightRange | null =>
    getActiveHighlightRange(input, cursorPos, knownLabels());

  const queryWord = (range: HighlightRange | null): string =>
    getQueryWordForSuggestions(input, range);

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
    history = [t, ...history.filter((h) => h !== t)].slice(0, maxHistory);
  }

  function doSubmit(overrideQuery?: string) {
    const finalQuery = (overrideQuery !== undefined ? overrideQuery : input).replace(/,\s*$/, '').trim();
    if (finalQuery) pushHistory(finalQuery);
    staged = [];
    emit('stage', [...staged]);
    isOpen = false;
    focusedIndex = -1;
    isChipJustSelected = true;
    render();
    emit('submit', finalQuery);
  }

  function toggleStage(item: GroupedItem) {
    const exists = staged.some((p) => p.id === item.id || p.label.toLowerCase() === item.label.toLowerCase());
    staged = exists
      ? staged.filter((p) => p.id !== item.id && p.label.toLowerCase() !== item.label.toLowerCase())
      : [...staged, item];
    emit('stage', [...staged]);
    isOpen = true;
    isChipJustSelected = false;
    render();
  }

  function commitStaged() {
    if (staged.length === 0) return;
    const range = activeRange();
    const qWord = queryWord(range);
    const labels = staged.map((s) => s.label);
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
    render();
    emit('change', updated);
  }

  function selectSingle(item: GroupedItem) {
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
    render();
    emit('change', updated);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isChipJustSelected && e.key !== 'Tab' && e.key !== 'Enter' && e.key !== 'Escape') {
      isChipJustSelected = false;
    }
    const range = activeRange();
    const qWord = queryWord(range);
    const grouped = qWord.length >= minChars
      ? getGroupedMetadata(items, qWord, { groupOrder, maxItemsPerGroup, maxTotalItems, exact: exactMatch })
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
      // toggleStage() already re-rendered; just move focus without another full render
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
    if (e.key === 'Escape') {
      if (focusedIndex >= 0) { updateFocusUI(focusedIndex, -1); return; }
      staged = [];
      emit('stage', [...staged]);
      isOpen = false;
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
    prevEl?.querySelector('.sa-match-focused')?.classList.remove('sa-match-focused');
    prevEl?.querySelector('.sa-keys')?.remove();
    if (nextEl) {
      nextEl.classList.add('sa-chip-focused');
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
    const range = activeRange();
    renderUnderlay(range);
    syncUnderlayScroll();
    const wasOpen = !dropdownEl.hidden && dropdownEl.innerHTML !== '';
    const prevScroll = dropdownEl.querySelector('.sa-groups')?.scrollTop ?? 0;

    if (!isOpen || disabled) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
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

    const qWord = queryWord(range);
    if (qWord.length < minChars || isChipJustSelected) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
      syncAria();
      return;
    }

    const t0 = performance.now();
    const grouped = getGroupedMetadata(items, qWord, { groupOrder, maxItemsPerGroup, maxTotalItems, exact: exactMatch });
    const ms = (performance.now() - t0).toFixed(1);
    if (grouped.totalHits === 0) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
      syncAria();
      return;
    }

    const stagedCount = staged.length;
    dropdownEl.hidden = false;
    dropdownEl.innerHTML = `
      <div class="sa-panel${wasOpen ? ' sa-no-anim' : ''}">
        ${showStatusBar ? `
        <div class="sa-status" role="status" aria-live="polite">
          <div class="sa-status-left">
            <span class="sa-ms">${ms} ms</span>
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
          ${grouped.groups.map((g) => {
            const th = themeForGroup(g.type);
            return `
            <div class="sa-group" role="group" aria-label="${escapeAttr(g.type)}">
              <div class="sa-group-badge" style="background:${th.bg};color:${th.text};border-color:${th.border}">
                <span class="sa-dot" style="background:${th.dot}" aria-hidden="true"></span>
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
                  return `<button type="button" role="option" id="${uid}-opt-${item.globalIndex}" aria-selected="${selected}" class="${cls.join(' ')}" data-gi="${item.globalIndex}" data-id="${escapeAttr(item.id)}" aria-label="${escapeAttr(item.label)}" title="${esc(item.label)}">${isStaged || inQuery ? '<span class="sa-tick" aria-hidden="true">✓</span>' : ''}<span>${renderHighlightedLabel(item.label, qWord, isFocused)}</span>${isFocused ? '<span class="sa-keys" aria-hidden="true"><span>Space</span><span>↵</span></span>' : ''}</button>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

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
    render();
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
      render();
    }
  };
  document.addEventListener('mousedown', onDocDown);

  // init
  refreshChrome();
  renderUnderlay(activeRange());

  const instance: AutocompleteInstance = {
    getQuery: () => inputEl.value,
    getText: () => inputEl.value,
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
      render();
      emit('change', v);
    },
    clear: () => {
      setInputValue('', false);
      staged = [];
      emit('stage', [...staged]);
      focusedIndex = -1;
      render();
      emit('change', '');
    },
    focus: () => { inputEl.focus(); isOpen = true; render(); },
    blur: () => inputEl.blur(),
    submit: (q) => doSubmit(q),
    getStaged: () => [...staged],
    clearStaged: () => { staged = []; emit('stage', [...staged]); render(); },
    getHistory: () => [...history],
    clearHistory: () => { history = []; render(); },
    setItems: (next) => { items = [...next]; focusedIndex = -1; render(); },
    getItems: () => [...items],
    setGroups: (g) => {
      groupOrder = g.map((x) => x.name);
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
    getElement: () => root,
    on: (evt, handler) => {
      listeners[evt].push(handler);
      return () => {
        listeners[evt] = listeners[evt].filter((h) => h !== handler);
      };
    },
    destroy: () => {
      document.removeEventListener('mousedown', onDocDown);
      root.remove();
    },
  };

  options.onReady?.(instance);
  return instance;
}

export type { AutocompleteOptions, AutocompleteInstance };
