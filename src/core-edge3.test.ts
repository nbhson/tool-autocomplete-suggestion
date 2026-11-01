import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutocomplete } from './index';

function input(): HTMLInputElement {
  return document.querySelector('.sa-input') as HTMLInputElement;
}

function dropdown(): HTMLElement {
  return document.querySelector('.sa-dropdown') as HTMLElement;
}

function chips(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.sa-chip')) as HTMLElement[];
}

function key(k: string, shiftKey = false): void {
  input().dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey }),
  );
}

const ITEMS = [
  { id: '1', group: 'Language', label: 'TypeScript' },
  { id: '2', group: 'Language', label: 'TypoScript' },
  { id: '3', group: 'Framework', label: 'React' },
];

describe('core edge: keyboard wrap + commit nhánh', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('Shift+Tab tại chip đầu → wrap về chip cuối', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    key('Tab', true);
    const focused = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(focused.dataset.gi).toBe('1');
    inst.destroy();
  });

  it('ArrowUp tại chip đầu → wrap về chip cuối', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    key('ArrowUp');
    const focused = document.querySelector('.sa-chip-focused') as HTMLElement;
    expect(focused.dataset.gi).toBe('1');
    inst.destroy();
  });

  it('Escape khi đang focus chip → chỉ bỏ focus, dropdown vẫn mở', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Tab');
    expect(document.querySelector('.sa-chip-focused')).toBeTruthy();
    key('Escape');
    expect(document.querySelector('.sa-chip-focused')).toBeNull();
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
    expect(dropdown().hidden).toBe(false);
    inst.destroy();
  });

  it('Enter khi không staged / không focus → submit query', () => {
    const onSubmit = vi.fn();
    const inst = createAutocomplete({ container: '#host', items: ITEMS, onSubmit });
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('Enter');
    expect(onSubmit).toHaveBeenCalledWith('typ');
    inst.destroy();
  });

  it('Space trên chip disabled → guard return, không stage', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'G', label: 'Alpha' },
        { id: '2', group: 'G', label: 'Alphas-lock', disabled: true },
      ],
    });
    inst.setQuery('alpha', { focus: false });
    input().focus();
    key('Tab'); // focus 0
    key(' '); // stage Alpha, focus chuyển sang chip disabled
    key(' '); // Space trên chip disabled → bỏ qua
    expect(inst.getStaged().map((s) => s.label)).toEqual(['Alpha']);
    inst.destroy();
  });

  it('commitStaged với từ đang gõ (range non-entity) → thay thế từ tại cursor', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('learn typ', { focus: false });
    chips()[0].click();
    chips()[1].click();
    key('Enter');
    expect(input().value).toBe('learn TypeScript, TypoScript');
    inst.destroy();
  });

  it('commitStaged với input kết thúc bằng dấu phẩy → gỡ dấu phẩy cuối', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('react,', { focus: false });
    chips()[0].click();
    key('Enter');
    expect(input().value).toBe('React');
    inst.destroy();
  });

  it('commitStaged khi dấu phẩy đứng độc lập → gắn vào cuối (quirk dấu ,)', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    inst.setQuery('react ,', { focus: false });
    key('Enter');
    // input.replace(/,\s*$/, '') loại dấu phẩy cuối; từ cuối "react" khớp qWord
    expect(input().value).toBe('react, TypeScript');
    inst.destroy();
  });

  it('selectSingle với range null (input kết thúc bằng dấu phẩy) → applySuggestion', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('react,', { focus: false });
    input().focus();
    key('Tab');
    key('Enter');
    expect(input().value.trim()).toBe('React');
    inst.destroy();
  });

  it('PageDown khi chưa focus chip nào → focus chip đầu tiên', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    input().focus();
    key('PageDown');
    expect((document.querySelector('.sa-chip-focused') as HTMLElement).dataset.gi).toBe('0');
    inst.destroy();
  });

  it('scrollIntoView được gọi khi focus chip di chuyển', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    input().focus(); // focus → re-render, gán spy trên chip mới
    chips().forEach((c) => {
      (c as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn();
    });
    key('Tab');
    const spy = (chips()[0] as unknown as { scrollIntoView: ReturnType<typeof vi.fn> }).scrollIntoView;
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'nearest', inline: 'nearest' }),
    );
    inst.destroy();
  });

  it('scroll position của danh sách được giữ qua re-render', () => {
    const items = Array.from({ length: 300 }, (_, i) => ({
      id: `i${i}`,
      group: 'Bulk',
      label: `bulk-item-${i}`,
    }));
    const inst = createAutocomplete({ container: '#host', items, virtualizeThreshold: 200 });
    inst.setQuery('bulk-item', { focus: false });
    const groups = document.querySelector('.sa-groups') as HTMLElement;
    groups.scrollTop = 42;
    chips()[0].click(); // stage → re-render
    const groups2 = document.querySelector('.sa-groups') as HTMLElement;
    expect(groups2.scrollTop).toBe(42);
    inst.destroy();
  });
});

describe('core edge: render nhánh', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('nhãn match một phần (token cuối) → highlight đúng đoạn khớp', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Movie', label: 'Dune Part Two' }],
    });
    inst.setQuery('dune two', { focus: false });
    const chip = chips()[0];
    expect(chip.textContent).toContain('Dune Part Two');
    const match = chip.querySelector('.sa-match');
    expect(match).toBeTruthy();
    expect(match?.textContent).toBe('Two');
    inst.destroy();
  });

  it('group icon an toàn → render icon; group icon không an toàn → warn + dot', () => {
    const warns: unknown[][] = [];
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger: {
        debug: () => {},
        info: () => {},
        warn: (...a: unknown[]) => warns.push(a),
        error: () => {},
      },
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
      groups: [
        { name: 'G', icon: '<img src=x onerror=alert(1)>' },
        { name: 'Empty' },
      ],
    });
    inst.setQuery('alp', { focus: false });
    expect(warns.some((w) => String(w[0]).includes('Dropping unsafe icon'))).toBe(true);
    expect(document.querySelector('.sa-dot')).toBeTruthy();
    inst.destroy();
  });

  it('group icon an toàn được render qua sa-group-icon', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
      groups: [{ name: 'G', icon: '<svg viewBox="0 0 10 10"><path d="M1 1"/></svg>' }],
    });
    inst.setQuery('alp', { focus: false });
    expect(document.querySelector('.sa-group-icon')).toBeTruthy();
    inst.destroy();
  });

  it('submitIcon không an toàn → warn + dùng icon mặc định', () => {
    const warns: unknown[][] = [];
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger: {
        debug: () => {},
        info: () => {},
        warn: (...a: unknown[]) => warns.push(a),
        error: () => {},
      },
      submitIcon: '<img src=x onerror=alert(1)>',
    });
    expect(warns.some((w) => String(w[0]).includes('Dropping unsafe submitIcon'))).toBe(true);
    expect((document.querySelector('.sa-submit') as HTMLElement).innerHTML).toContain('<svg');
    inst.destroy();
  });

  it('tokens.maxDropdownHeight nhận cả chuỗi CSS lẫn số px', () => {
    const inst = createAutocomplete({
      container: '#host',
      tokens: { maxDropdownHeight: '50vh' },
    });
    expect(inst.getElement().style.getPropertyValue('--sa-drop-max')).toBe('50vh');
    inst.setBorderRadius(8);
    inst.setTheme('#0ea5e9');
    inst.destroy();
  });
});
