import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutocomplete } from './index';
import type { AutocompleteInstance } from './types';

const ITEMS = [
  { id: '1', group: 'Language', label: 'TypeScript' },
  { id: '2', group: 'Language', label: 'TypoScript' },
  { id: '3', group: 'Framework', label: 'React' },
];

function setup(opts: Record<string, unknown> = {}): AutocompleteInstance<unknown> {
  return createAutocomplete({ container: '#host', items: ITEMS, ...opts });
}

function input(): HTMLInputElement {
  return document.querySelector('.sa-input') as HTMLInputElement;
}

function key(k: string, shiftKey = false): void {
  input().dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey }),
  );
}

function chips(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.sa-chip')) as HTMLElement[];
}

describe('core behavior: staged multi-select', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('click a chip stages it, click again unstages, onStageChange fires', () => {
    const onStageChange = vi.fn();
    const inst = setup({ onStageChange });
    inst.setQuery('typ', { focus: false });
    const [chip] = chips();
    chip.click();
    expect(inst.getStaged().map((s) => s.label)).toEqual(['TypeScript']);
    // render() rebuilds the dropdown — re-query the live chip element
    const stagedChip = chips()[0];
    expect(stagedChip.dataset.staged).toBe('true');
    expect(stagedChip.getAttribute('aria-selected')).toBe('true');
    stagedChip.click();
    expect(inst.getStaged()).toEqual([]);
    expect(onStageChange).toHaveBeenCalledTimes(2);
    inst.destroy();
  });

  it('Space key toggles staging on the focused chip', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    expect(document.querySelector('.sa-chip-focused')).toBeTruthy();
    key(' ');
    expect(inst.getStaged().map((s) => s.label)).toEqual(['TypeScript']);
    // Space advances focus to the next chip, so the second Space stages it
    key(' ');
    expect(inst.getStaged().map((s) => s.label)).toEqual(['TypeScript', 'TypoScript']);
    inst.destroy();
  });

  it('Enter with staged items commits them into the input without submitting', () => {
    let submitted: string | null = null;
    const inst = setup({ onSubmit: (q: string) => (submitted = q) });
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    chips()[1].click();
    key('Enter');
    expect(input().value).toBe('TypeScript, TypoScript');
    expect(inst.getStaged()).toEqual([]);
    expect(submitted).toBeNull();
    inst.destroy();
  });

  it('Enter with a focused chip applies that single suggestion', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    key('Enter');
    // single-select appends a trailing space so typing can continue
    expect(input().value.trim()).toBe('TypeScript');
    inst.destroy();
  });

  it('clearStaged() empties the staged buffer', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    expect(inst.getStaged()).toHaveLength(1);
    inst.clearStaged();
    expect(inst.getStaged()).toEqual([]);
    inst.destroy();
  });

  it('disabled items are never staged', () => {
    const inst = setup({ items: [{ id: '1', group: 'G', label: 'Locked', disabled: true }] });
    inst.setQuery('lock', { focus: false });
    chips()[0].click();
    expect(inst.getStaged()).toEqual([]);
    inst.destroy();
  });

  it('staged items count shows in the status bar and Apply button', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    const status = document.querySelector('.sa-status') as HTMLElement;
    expect(status.textContent).toContain('Selected: 1');
    const apply = document.querySelector('.sa-apply') as HTMLButtonElement;
    expect(apply.textContent).toContain('Apply (1)');
    apply.click();
    expect(inst.getStaged()).toEqual([]);
    expect(input().value).toBe('TypeScript');
    inst.destroy();
  });

  it('Escape clears staged items then closes the dropdown', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    expect(inst.getStaged()).toHaveLength(1);
    key('Escape');
    expect(inst.getStaged()).toEqual([]);
    key('Escape');
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(true);
    inst.destroy();
  });
});

describe('core behavior: keyboard navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('ArrowDown / ArrowUp cycle focus both directions', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    const first = document.querySelector('.sa-chip-focused') as HTMLElement;
    key('ArrowDown');
    const second = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(second).not.toBe(first);
    key('ArrowUp');
    expect(document.querySelector('.sa-chip-focused')).toBe(first);
    inst.destroy();
  });

  it('ArrowRight / ArrowLeft also navigate chips', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    const first = document.querySelector('.sa-chip-focused') as HTMLElement;
    key('ArrowRight');
    const second = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(second).not.toBe(first);
    key('ArrowLeft');
    expect(document.querySelector('.sa-chip-focused')).toBe(first);
    inst.destroy();
  });

  it('PageDown / PageUp jump 5 chips and clamp to bounds', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `i${i}`,
      group: 'G',
      label: `item-${i}`,
    }));
    const inst = setup({ items });
    inst.setQuery('item', { focus: false });
    input().focus();
    key('Tab');
    key('PageDown');
    const jumped = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(jumped.dataset.gi).toBe('5');
    key('PageUp');
    expect((document.querySelector('.sa-chip-focused') as HTMLElement).dataset.gi).toBe('0');
    key('End');
    expect((document.querySelector('.sa-chip-focused') as HTMLElement).dataset.gi).toBe('11');
    key('Home');
    expect((document.querySelector('.sa-chip-focused') as HTMLElement).dataset.gi).toBe('0');
    inst.destroy();
  });

  it('Shift+Tab moves focus backwards', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    key('Tab');
    key('Tab', true);
    const focused = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(focused.dataset.gi).toBe('0');
    inst.destroy();
  });
});

describe('core behavior: instance methods', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('enable/disable/isDisabled toggle input + styling', () => {
    const inst = setup();
    expect(inst.isDisabled()).toBe(false);
    inst.disable();
    expect(inst.isDisabled()).toBe(true);
    expect(input().disabled).toBe(true);
    expect(inst.getElement().classList.contains('sa-disabled')).toBe(true);
    inst.enable();
    expect(inst.isDisabled()).toBe(false);
    expect(input().disabled).toBe(false);
    inst.destroy();
  });

  it('disabled mode hides the dropdown and disables submit', () => {
    const inst = setup({ disabled: true });
    inst.setQuery('typ', { focus: false });
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(true);
    expect((document.querySelector('.sa-submit') as HTMLButtonElement).disabled).toBe(true);
    inst.destroy();
  });

  it('setDropup toggles the sa-dropup class at runtime', () => {
    const inst = setup();
    expect(inst.getElement().classList.contains('sa-dropup')).toBe(false);
    inst.setDropup(true);
    expect(inst.getElement().classList.contains('sa-dropup')).toBe(true);
    inst.setDropup(false);
    expect(inst.getElement().classList.contains('sa-dropup')).toBe(false);
    inst.destroy();
  });

  it('setTheme updates accent CSS variables', () => {
    const inst = setup();
    inst.setTheme('#7c3aed', '#5b21b6');
    expect(inst.getElement().style.getPropertyValue('--sa-accent')).toBe('#7c3aed');
    expect(inst.getElement().style.getPropertyValue('--sa-accent-dark')).toBe('#5b21b6');
    inst.destroy();
  });

  it('setGroups updates group order', () => {
    const inst = setup();
    inst.setGroups([{ name: 'Framework' }, { name: 'Language' }]);
    inst.setQuery('e', { focus: false });
    const firstGroup = document.querySelector('.sa-group') as HTMLElement;
    expect(firstGroup.getAttribute('aria-label')).toBe('Framework');
    inst.destroy();
  });

  it('clear() resets query, staged and async state, emits change', () => {
    const onChange = vi.fn();
    const onStageChange = vi.fn();
    const inst = setup({ onChange, onStageChange });
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    inst.clear();
    expect(inst.getQuery()).toBe('');
    expect(inst.getStaged()).toEqual([]);
    expect(onChange).toHaveBeenCalledWith('');
    inst.destroy();
  });

  it('clear button resets query and focuses input', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    const clear = document.querySelector('.sa-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(inst.getQuery()).toBe('');
    expect(inst.isEmpty()).toBe(true);
    inst.destroy();
  });

  it('submit() saves history; clearHistory() empties it', () => {
    const inst = setup({ maxHistory: 3, history: ['old query'] });
    inst.setQuery('new query', { focus: false });
    inst.submit();
    expect(inst.getHistory()).toEqual(['new query', 'old query']);
    inst.clearHistory();
    expect(inst.getHistory()).toEqual([]);
    inst.destroy();
  });

  it('maxHistory=0 disables history entirely', () => {
    const inst = setup({ maxHistory: 0 });
    inst.setQuery('nope', { focus: false });
    inst.submit();
    expect(inst.getHistory()).toEqual([]);
    input().focus();
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(true);
    inst.destroy();
  });

  it('submit with empty query does not push history', () => {
    const inst = setup();
    inst.submit();
    expect(inst.getHistory()).toEqual([]);
    inst.destroy();
  });

  it('on() subscribes and unsubscribe works', () => {
    const inst = setup();
    const calls: string[] = [];
    const offSubmit = inst.on('submit', () => calls.push('submit'));
    const offChange = inst.on('change', () => calls.push('change'));
    offChange();
    inst.setQuery('x', { focus: false });
    inst.submit();
    offSubmit();
    inst.submit();
    expect(calls).toEqual(['submit']);
    inst.destroy();
  });

  it('onFocus/onBlur fire via options and on()', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const events: string[] = [];
    const inst = setup({ onFocus, onBlur });
    inst.on('focus', () => events.push('focus'));
    inst.on('blur', () => events.push('blur'));
    input().focus();
    input().blur();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['focus', 'blur']);
    inst.destroy();
  });

  it('formJoin customizes hidden input serialization', () => {
    const inst = setup({ name: 'q', formJoin: ' | ' });
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    const hidden = document.querySelector('input[name="q"]') as HTMLInputElement;
    expect(hidden.value).toBe('typ | TypeScript');
    expect(inst.getFormValue()).toBe('typ | TypeScript');
    inst.destroy();
  });

  it('bar click (outside buttons) focuses the input', () => {
    const inst = setup();
    const bar = document.querySelector('.sa-bar') as HTMLElement;
    const spy = vi.spyOn(input(), 'focus');
    bar.click();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    inst.destroy();
  });

  it('clicking a history entry applies it and submits', () => {
    const onSubmit = vi.fn();
    const inst = setup({ history: ['previous search'], onSubmit });
    input().focus();
    const entry = document.querySelector('.sa-history') as HTMLButtonElement;
    expect(entry).toBeTruthy();
    entry.click();
    expect(onSubmit).toHaveBeenCalledWith('previous search');
    expect(input().value).toBe('previous search');
    inst.destroy();
  });

  it('mouseleave-free mouseenter moves chip focus without rebuild', () => {
    const inst = setup();
    inst.setQuery('typ', { focus: false });
    const before = document.querySelector('.sa-panel') as HTMLElement;
    chips()[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    expect(document.querySelector('.sa-chip-focused')).toBe(chips()[1]);
    expect((document.querySelector('.sa-panel') as HTMLElement)).toBe(before);
    inst.destroy();
  });
});

describe('core behavior: filtering options', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('minChars gates suggestions (query shorter than threshold shows nothing)', () => {
    const inst = setup({ minChars: 4 });
    inst.setQuery('typ', { focus: false });
    expect((document.querySelector('.sa-dropdown') as HTMLElement).hidden).toBe(true);
    inst.setQuery('type', { focus: false });
    expect((document.querySelector('.sa-dropdown') as HTMLElement).hidden).toBe(false);
    inst.destroy();
  });

  it('maxTotalItems caps total hits across groups', () => {
    const inst = setup({ maxTotalItems: 1 });
    inst.setQuery('typ', { focus: false });
    expect(chips().length).toBe(1);
    inst.destroy();
  });

  it('maxItemsPerGroup caps hits per group', () => {
    const inst = setup({ maxItemsPerGroup: 1 });
    inst.setQuery('typ', { focus: false });
    document.querySelectorAll('.sa-group').forEach((g) => {
      expect(g.querySelectorAll('.sa-chip').length).toBeLessThanOrEqual(1);
    });
    inst.destroy();
  });

  it('showStatusBar=false and showApplyButton=false hide the extras', () => {
    const inst = setup({ showStatusBar: false });
    inst.setQuery('typ', { focus: false });
    expect(document.querySelector('.sa-status')).toBeNull();
    inst.destroy();
    document.body.innerHTML = '<div id="host"></div>';
    const inst2 = setup({ showApplyButton: false });
    inst2.setQuery('typ', { focus: false });
    expect(document.querySelector('[data-sa="apply"]')).toBeNull();
    inst2.destroy();
  });

  it('showHistory=false hides recent searches even with history', () => {
    const inst = setup({ showHistory: false, history: ['old'] });
    input().focus();
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.textContent).not.toContain('Recent searches');
    inst.destroy();
  });

  it('matchMode exact is case-sensitive literal', () => {
    const inst = setup({ matchMode: 'exact' });
    inst.setQuery('type', { focus: false });
    expect((document.querySelector('.sa-dropdown') as HTMLElement).hidden).toBe(true);
    inst.setQuery('Type', { focus: false });
    expect((document.querySelector('.sa-dropdown') as HTMLElement).hidden).toBe(false);
    inst.destroy();
  });
});
