import { beforeEach, describe, expect, it } from 'vitest';
import { createAutocomplete } from './index';
import type { SuggestionItem } from './types';

/**
 * A11y pass — xác minh đúng pattern ARIA combobox (WAI-ARIA 1.2):
 * - input[role=combobox] với aria-expanded / aria-controls / aria-autocomplete
 * - listbox[role=listbox] chứa option[role=option] + aria-selected
 * - focus qua bàn phím cập nhật aria-activedescendant (không dùng roving tabindex)
 * - live region role=status cho announce; lỗi dùng role=alert
 */
describe('a11y: ARIA combobox pattern', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  function key(k: string): void {
    (document.querySelector('.sa-input') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
    );
  }

  it('input giữ đầy đủ thuộc tính combobox ngay từ đầu', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    const inp = document.querySelector('.sa-input') as HTMLInputElement;
    expect(inp.getAttribute('role')).toBe('combobox');
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    expect(inp.getAttribute('aria-autocomplete')).toBe('list');
    expect(inp.getAttribute('aria-controls')).toBeTruthy();
    expect(inp.getAttribute('aria-describedby')).toBeTruthy();
    // vùng mô tả là live region role=status
    const live = document.getElementById(inp.getAttribute('aria-describedby') as string);
    expect(live?.getAttribute('role')).toBe('status');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    inst.destroy();
  });

  it('mở dropdown → aria-expanded=true; listbox + option đầy đủ id/aria-selected', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'G', label: 'Alpha' },
        { id: '2', group: 'G', label: 'Alphabet' },
      ],
    });
    const inp = document.querySelector('.sa-input') as HTMLInputElement;
    const listboxId = inp.getAttribute('aria-controls') as string;
    inst.setQuery('alp', { focus: false });
    expect(inp.getAttribute('aria-expanded')).toBe('true');
    const listbox = document.getElementById(listboxId) as HTMLElement;
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.hidden).toBe(false);
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    options.forEach((opt) => {
      expect(opt.id).toContain('-opt-');
      expect(opt.getAttribute('aria-selected')).toBe('false');
    });
    inst.destroy();
  });

  it('điều hướng bàn phím cập nhật aria-activedescendant (không roving tabindex)', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'G', label: 'Alpha' },
        { id: '2', group: 'G', label: 'Alphabet' },
      ],
    });
    const inp = document.querySelector('.sa-input') as HTMLInputElement;
    inst.setQuery('alp', { focus: false });
    expect(inp.getAttribute('aria-activedescendant')).toBeNull();
    inp.focus();
    key('Tab');
    const first = document.querySelector('.sa-chip') as HTMLElement;
    expect(inp.getAttribute('aria-activedescendant')).toBe(first.id);
    expect(first.getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    const second = document.querySelectorAll('.sa-chip')[1] as HTMLElement;
    expect(inp.getAttribute('aria-activedescendant')).toBe(second.id);
    // chip trước mất trạng thái aria-selected (quay về theo staged/inquery)
    expect(first.getAttribute('aria-selected')).toBe('false');
    // focus giữ trên input — combobox pattern dùng activedescendant
    expect(document.activeElement).toBe(inp);
    expect(inp.hasAttribute('tabindex')).toBe(false);
    inst.destroy();
  });

  it('aria-selected phản ánh trạng thái staged', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    inst.setQuery('alp', { focus: false });
    const chip = document.querySelector('.sa-chip') as HTMLElement;
    expect(chip.getAttribute('aria-selected')).toBe('false');
    chip.click();
    const chip2 = document.querySelector('.sa-chip') as HTMLElement;
    expect(chip2.getAttribute('aria-selected')).toBe('true');
    expect(chip2.getAttribute('data-staged')).toBe('true');
    inst.destroy();
  });

  it('live region announce số kết quả sau mỗi lần render', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'Language', label: 'Alpha' },
        { id: '2', group: 'Framework', label: 'Alphabet' },
      ],
    });
    inst.setQuery('alpha', { focus: false });
    const live = document.querySelector('.sa-sr') as HTMLElement;
    expect(live.textContent).toContain('2 hits');
    expect(live.textContent).toContain('2 groups');
    inst.destroy();
  });

  it('item disabled có aria-disabled và không thể chọn', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Locked', disabled: true }],
    });
    inst.setQuery('lock', { focus: false });
    const chip = document.querySelector('.sa-chip') as HTMLElement;
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    expect(chip.hasAttribute('disabled')).toBe(true);
    chip.click();
    expect(inst.getStaged()).toEqual([]);
    inst.destroy();
  });

  it('nhóm có role=group + aria-label; Async loading dùng role=status; lỗi dùng role=alert', async () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Language', label: 'Alpha' }],
    });
    inst.setQuery('alpha', { focus: false });
    const group = document.querySelector('.sa-group') as HTMLElement;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Language');
    inst.destroy();

    document.body.innerHTML = '<div id="host"></div>';
    const inst2 = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: (): Promise<SuggestionItem<unknown>[]> => new Promise(() => {}), // treo vĩnh viễn → loading
    });
    inst2.setQuery('zz', { focus: false });
    const loading = document.querySelector('.sa-loading') as HTMLElement;
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    inst2.destroy();

    document.body.innerHTML = '<div id="host"></div>';
    const inst3 = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async () => {
        throw new Error('boom');
      },
    });
    inst3.setQuery('zz', { focus: false });
    await new Promise((r) => setTimeout(r, 15));
    const err = document.querySelector('.sa-error') as HTMLElement;
    expect(err.getAttribute('role')).toBe('alert');
    const retry = document.querySelector('[data-sa="retry"]') as HTMLButtonElement;
    expect(retry.tagName).toBe('BUTTON');
    inst3.destroy();
  });

  it('đóng dropdown → aria-expanded=false + xoá aria-activedescendant', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    const inp = document.querySelector('.sa-input') as HTMLInputElement;
    inst.setQuery('alpha', { focus: false });
    key('Tab');
    key('Escape');
    key('Escape');
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    expect(inp.getAttribute('aria-activedescendant')).toBeNull();
    inst.destroy();
  });
});
