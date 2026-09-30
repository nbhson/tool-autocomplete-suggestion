import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutocomplete } from './index';

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('enterprise core', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('async dataSource resolves suggestions with debounce 0', async () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async ({ query }) => {
        await flush(5);
        return query.startsWith('rea')
          ? [{ id: '1', group: 'Framework', label: 'React' }]
          : [];
      },
    });
    inst.setQuery('rea', { focus: false });
    expect(inst.isLoading()).toBe(true);
    await flush(30);
    expect(inst.isLoading()).toBe(false);
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(false);
    expect(dd.textContent).toContain('React');
    inst.destroy();
  });

  it('async error renders retry UI and fires onAsyncError + telemetry', async () => {
    const onAsyncError = vi.fn();
    const onError = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async () => {
        throw new Error('boom');
      },
      onAsyncError,
      telemetry: { onError },
    });
    inst.setQuery('abc', { focus: false });
    await flush(30);
    expect(onAsyncError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sa-error')).toBeTruthy();
    expect(document.querySelector('[data-sa="retry"]')).toBeTruthy();
    inst.destroy();
  });

  it('caches async results per query (second identical query skips provider)', async () => {
    let calls = 0;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async () => {
        calls++;
        return [{ id: '1', group: 'G', label: 'Alpha' }];
      },
    });
    inst.setQuery('alp', { focus: false });
    await flush(30);
    inst.setQuery('', { focus: false });
    inst.setQuery('alp', { focus: false });
    await flush(30);
    expect(calls).toBe(1);
    inst.destroy();
  });

  it('virtualizes large hit lists with a footer', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `i${i}`,
      group: 'Bulk',
      label: `bulk-item-${i}`,
    }));
    const inst = createAutocomplete({ container: '#host', items, virtualizeThreshold: 100 });
    inst.setQuery('bulk-item', { focus: false });
    const chips = document.querySelectorAll('.sa-chip');
    expect(chips.length).toBe(100);
    expect(document.querySelector('.sa-more')?.textContent).toContain('500');
    inst.destroy();
  });

  it('sanitizes malicious submitIcon back to default', () => {
    const inst = createAutocomplete({
      container: '#host',
      submitIcon: '<img src=x onerror=alert(1)><svg><path d="M1 1"/></svg>',
    });
    const btn = document.querySelector('.sa-submit') as HTMLElement;
    expect(btn.querySelector('img')).toBeNull();
    expect(btn.innerHTML).toContain('<svg');
    inst.destroy();
  });

  it('renders hidden form input when name is set + getFormValue()', () => {
    const inst = createAutocomplete({ container: '#host', name: 'q' });
    const hidden = document.querySelector('input[type="hidden"][name="q"]') as HTMLInputElement;
    expect(hidden).toBeTruthy();
    inst.setQuery('hello', { focus: false });
    expect(hidden.value).toBe('hello');
    expect(inst.getFormValue()).toBe('hello');
    inst.destroy();
  });

  it('supports RTL + density + theme tokens', () => {
    const inst = createAutocomplete({
      container: '#host',
      tokens: { direction: 'rtl', density: 'compact', theme: 'dark' },
    });
    const root = inst.getElement();
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.classList.contains('sa-rtl')).toBe(true);
    expect(root.getAttribute('data-sa-density')).toBe('compact');
    expect(root.getAttribute('data-sa-theme')).toBe('dark');
    inst.destroy();
  });

  it('emits telemetry onSearch for sync queries', () => {
    const onSearch = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
      telemetry: { onSearch },
    });
    inst.setQuery('typ', { focus: false });
    expect(onSearch).toHaveBeenCalled();
    expect(onSearch.mock.calls[0][0]).toMatchObject({ query: 'typ', source: 'sync' });
    inst.destroy();
  });

  it('reload() re-renders sync and refetches async', async () => {
    let calls = 0;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      asyncCache: false,
      dataSource: async () => {
        calls++;
        return [{ id: '1', group: 'G', label: 'Beta' }];
      },
    });
    inst.setQuery('bet', { focus: false });
    await flush(30);
    inst.reload();
    await flush(30);
    expect(calls).toBe(2);
    inst.destroy();
  });

  it('Home/End/PageDown navigate chips without rebuild', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'Language', label: 'TypeScript' },
        { id: '2', group: 'Language', label: 'TypoScript' },
        { id: '3', group: 'Language', label: 'Typst' },
      ],
    });
    inst.setQuery('typ', { focus: false });
    const input = document.querySelector('.sa-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.querySelector('.sa-chip-focused')).toBeTruthy();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.querySelector('.sa-chip-focused')).toBeTruthy();
    inst.destroy();
  });

  it('status bar is minimal: hits count only, no scope/ms/hints/replacing', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
    });
    inst.setQuery('typ', { focus: false });
    const status = document.querySelector('.sa-status') as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('hits');
    expect(status.textContent).not.toContain('scope');
    expect(status.textContent).not.toContain('ALL');
    expect(status.textContent).not.toContain('replacing');
    expect(status.querySelector('.sa-ms')).toBeNull();
    expect(status.querySelector('.sa-hint')).toBeNull();
    expect(status.querySelector('.sa-apply')?.textContent).toContain('Apply');
    inst.destroy();
  });

  it('status bar shows timing only in debug mode', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
      debug: true,
    });
    inst.setQuery('typ', { focus: false });
    expect(document.querySelector('.sa-status .sa-ms')?.textContent).toMatch(/ms/);
    inst.destroy();
  });

  it('extended design tokens map to CSS variables', () => {
    const inst = createAutocomplete({
      container: '#host',
      tokens: {
        fontFamily: 'Georgia, serif',
        fontSize: 17,
        background: '#111827',
        foreground: '#f9fafb',
        borderColor: '#374151',
        mutedColor: '#9ca3af',
        dropdownRadius: 10,
        shadow: 'none',
        cssVars: { '--sa-custom': '42px', 'sa-nodash': 'yes' },
      },
    });
    const root = inst.getElement();
    expect(root.style.getPropertyValue('--sa-font')).toBe('Georgia, serif');
    expect(root.style.getPropertyValue('--sa-font-size')).toBe('17px');
    expect(root.style.getPropertyValue('--sa-bg')).toBe('#111827');
    expect(root.style.getPropertyValue('--sa-fg')).toBe('#f9fafb');
    expect(root.style.getPropertyValue('--sa-border')).toBe('#374151');
    expect(root.style.getPropertyValue('--sa-muted')).toBe('#9ca3af');
    expect(root.style.getPropertyValue('--sa-drop-radius')).toBe('10px');
    expect(root.style.getPropertyValue('--sa-shadow')).toBe('none');
    expect(root.style.getPropertyValue('--sa-custom')).toBe('42px');
    expect(root.style.getPropertyValue('--sa-nodash')).toBe('yes');
    inst.destroy();
  });

  it('invalid cssVar names are ignored safely', () => {
    const inst = createAutocomplete({
      container: '#host',
      tokens: { cssVars: { 'color: red; --x': 'evil' } },
    });
    const root = inst.getElement();
    expect(root.getAttribute('style') ?? '').not.toContain('evil');
    inst.destroy();
  });
});
