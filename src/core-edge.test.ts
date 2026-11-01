import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutocomplete } from './index';
import type { Logger } from './types';

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function input(): HTMLInputElement {
  return document.querySelector('.sa-input') as HTMLInputElement;
}

function dropdown(): HTMLElement {
  return document.querySelector('.sa-dropdown') as HTMLElement;
}

function chips(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.sa-chip')) as HTMLElement[];
}

const ITEMS = [
  { id: '1', group: 'Language', label: 'TypeScript' },
  { id: '2', group: 'Language', label: 'TypoScript' },
  { id: '3', group: 'Framework', label: 'React' },
];

function makeLogger(): Logger & { warns: unknown[][]; errors: unknown[][] } {
  const warns: unknown[][] = [];
  const errors: unknown[][] = [];
  return {
    warns,
    errors,
    debug: () => {},
    info: () => {},
    warn: (...args: unknown[]) => warns.push(args),
    error: (...args: unknown[]) => errors.push(args),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('core edge: historyAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('load() đồng bộ trả mảng → history khả dụng ngay', () => {
    const inst = createAutocomplete({
      container: '#host',
      historyAdapter: { load: () => ['sync entry'], save: () => {}, clear: () => {} },
    });
    expect(inst.getHistory()).toEqual(['sync entry']);
    inst.destroy();
  });

  it('load() bất đồng bộ → history cập nhật sau khi promise resolve', async () => {
    const inst = createAutocomplete({
      container: '#host',
      historyAdapter: {
        load: async () => ['async entry'],
        save: () => {},
        clear: () => {},
      },
    });
    expect(inst.getHistory()).toEqual([]);
    await flush(10);
    expect(inst.getHistory()).toEqual(['async entry']);
    inst.destroy();
  });

  it('load() promise reject → logger.warn, không crash', async () => {
    const logger = makeLogger();
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger,
      historyAdapter: {
        load: () => Promise.reject(new Error('storage down')),
        save: () => {},
        clear: () => {},
      },
    });
    await flush(10);
    expect(logger.warns.length).toBe(1);
    expect(String(logger.warns[0][0])).toContain('rejected');
    inst.destroy();
  });

  it('load() ném lỗi đồng bộ → logger.warn, không crash', () => {
    const logger = makeLogger();
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger,
      historyAdapter: {
        load: () => {
          throw new Error('boom');
        },
        save: () => {},
        clear: () => {},
      },
    });
    expect(logger.warns.length).toBe(1);
    expect(String(logger.warns[0][0])).toContain('threw');
    inst.destroy();
  });

  it('save() ném lỗi khi push history → logger.warn', () => {
    const logger = makeLogger();
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger,
      historyAdapter: {
        load: () => [],
        save: () => {
          throw new Error('quota');
        },
        clear: () => {},
      },
    });
    inst.setQuery('abc', { focus: false });
    inst.submit();
    expect(inst.getHistory()).toEqual(['abc']);
    expect(logger.warns.some((w) => String(w[0]).includes('save() threw'))).toBe(true);
    inst.destroy();
  });

  it('clearHistory() ném lỗi adapter → logger.warn, history vẫn reset', () => {
    const logger = makeLogger();
    const inst = createAutocomplete({
      container: '#host',
      debug: true,
      logger,
      historyAdapter: {
        load: () => ['old'],
        save: () => {},
        clear: () => {
          throw new Error('nope');
        },
      },
    });
    inst.clearHistory();
    expect(inst.getHistory()).toEqual([]);
    expect(logger.warns.some((w) => String(w[0]).includes('clear() threw'))).toBe(true);
    inst.destroy();
  });
});

describe('core edge: DOM events trên input', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('sự kiện input mở dropdown và render gợi ý', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    const inp = input();
    inp.value = 'typ';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dropdown().hidden).toBe(false);
    expect(dropdown().textContent).toContain('TypeScript');
    inst.destroy();
  });

  it('sự kiện input xoá trắng → reset staged + focus', () => {
    const onStageChange = vi.fn();
    const inst = createAutocomplete({ container: '#host', items: ITEMS, onStageChange });
    inst.setQuery('typ', { focus: false });
    chips()[0].click();
    expect(inst.getStaged()).toHaveLength(1);
    const inp = input();
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(inst.getStaged()).toEqual([]);
    inst.destroy();
  });

  it('keyup / click / select / scroll không crash và cập nhật underlay', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('learn typ', { focus: false });
    const inp = input();
    inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    inp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    inp.dispatchEvent(new Event('select'));
    inp.dispatchEvent(new Event('scroll'));
    expect(dropdown().textContent).toContain('TypeScript');
    inst.destroy();
  });

  it('mousedown ngoài root → đóng dropdown', () => {
    const inst = createAutocomplete({ container: '#host', items: ITEMS });
    inst.setQuery('typ', { focus: false });
    expect(dropdown().hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(dropdown().hidden).toBe(true);
    inst.destroy();
  });

  it('click nút submit → doSubmit + onSubmit', () => {
    const onSubmit = vi.fn();
    const inst = createAutocomplete({ container: '#host', items: ITEMS, onSubmit });
    inst.setQuery('typ', { focus: false });
    (document.querySelector('.sa-submit') as HTMLButtonElement).click();
    expect(onSubmit).toHaveBeenCalledWith('typ');
    inst.destroy();
  });
});
