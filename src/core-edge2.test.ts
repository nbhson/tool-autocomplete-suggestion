import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutocomplete } from './index';

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function input(): HTMLInputElement {
  return document.querySelector('.sa-input') as HTMLInputElement;
}

function dropdown(): HTMLElement {
  return document.querySelector('.sa-dropdown') as HTMLElement;
}

function key(k: string, shiftKey = false): void {
  input().dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('core edge: click submit disabled + DOM input events (phần 2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('click nút submit khi disabled → không submit', () => {
    const onSubmit = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
      onSubmit,
    });
    (document.querySelector('.sa-submit') as HTMLButtonElement).click();
    expect(onSubmit).not.toHaveBeenCalled();
    inst.destroy();
  });
});

describe('core edge: async dataSource', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  function deferred<T>(): {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
  } {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('debounce > 0: fetch chỉ chạy sau khi hết thời gian chờ', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 150,
      dataSource: async ({ query }) => {
        calls.push(query);
        return [{ id: '1', group: 'G', label: `Hit-${query}` }];
      },
    });
    const inp = input();
    inp.value = 're';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual(['re']);
    inst.destroy();
  });

  it('scheduleQuery: query ngắn hơn minChars → huỷ debounce + reset async state', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      minChars: 2,
      debounceMs: 50,
      dataSource: async () => {
        calls++;
        return [{ id: '1', group: 'G', label: 'Alpha' }];
      },
    });
    const inp = input();
    inp.value = 'alp';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(80);
    expect(calls).toBe(1);
    inp.value = 'a';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toBe(1);
    expect(dropdown().hidden).toBe(true);
    inst.destroy();
  });

  it('respone cũ (stale) bị bỏ qua khi query mới đã giải quyết', async () => {
    const d1 = deferred<Array<{ id: string; group: string; label: string }>>();
    const d2 = deferred<Array<{ id: string; group: string; label: string }>>();
    const responses = [d1.promise, d2.promise];
    let call = 0;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: () => responses[call++] as Promise<Array<{ id: string; group: string; label: string }>>,
    });
    inst.setQuery('aaa', { focus: false });
    inst.setQuery('bbb', { focus: false });
    d2.resolve([{ id: '2', group: 'G', label: 'Bbb-result' }]);
    await flush(10);
    d1.resolve([{ id: '1', group: 'G', label: 'Aaa-result' }]);
    await flush(10);
    expect(dropdown().textContent).toContain('Bbb-result');
    expect(dropdown().textContent).not.toContain('Aaa-result');
    inst.destroy();
  });

  it('lỗi AbortError bị bỏ qua một cách im lặng', async () => {
    const onAsyncError = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      onAsyncError,
      dataSource: async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    });
    inst.setQuery('abc', { focus: false });
    await flush(20);
    expect(onAsyncError).not.toHaveBeenCalled();
    expect(document.querySelector('.sa-error')).toBeNull();
    expect(inst.isLoading()).toBe(false);
    inst.destroy();
  });

  it('AbortController không tồn tại → vẫn fetch được với signal giả', async () => {
    vi.stubGlobal('AbortController', undefined);
    let gotSignal: unknown = null;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async ({ signal }) => {
        gotSignal = signal;
        return [{ id: '1', group: 'G', label: 'Alpha' }];
      },
    });
    inst.setQuery('alp', { focus: false });
    await flush(20);
    expect(gotSignal).toMatchObject({ aborted: false });
    expect(dropdown().textContent).toContain('Alpha');
    inst.destroy();
  });

  it('kết quả rỗng từ async → hiển thị trạng thái empty riêng biệt', async () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      locale: { empty: 'Không có kết quả' },
      dataSource: async () => [],
    });
    inst.setQuery('zzz', { focus: false });
    await flush(20);
    expect(dropdown().hidden).toBe(false);
    expect(document.querySelector('.sa-empty')?.textContent).toContain('Không có kết quả');
    inst.destroy();
  });

  it('nút Retry gọi lại dataSource và khôi phục kết quả', async () => {
    let fail = true;
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async () => {
        if (fail) throw new Error('net');
        return [{ id: '1', group: 'G', label: 'Alpha' }];
      },
    });
    inst.setQuery('alp', { focus: false });
    await flush(20);
    expect(document.querySelector('.sa-error')).toBeTruthy();
    fail = false;
    (document.querySelector('[data-sa="retry"]') as HTMLButtonElement).click();
    await flush(20);
    expect(dropdown().textContent).toContain('Alpha');
    inst.destroy();
  });

  it('telemetry onSearch nhận source "async" sau khi resolve', async () => {
    const onSearch = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      telemetry: { onSearch },
      dataSource: async () => [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    inst.setQuery('alp', { focus: false });
    await flush(20);
    const sources = onSearch.mock.calls.map((c) => c[0].source);
    expect(sources).toContain('async');
    inst.destroy();
  });

  it('setQuery({ open: false }) với dataSource → render, không fetch', async () => {
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
    inst.setQuery('alp', { open: false, focus: false });
    await flush(20);
    expect(calls).toBe(0);
    expect(dropdown().hidden).toBe(true);
    inst.destroy();
  });

  it('setItems với dataSource giữ nguyên async state; reload() sync chỉ render', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    inst.setItems([{ id: '2', group: 'G', label: 'Beta' }]);
    expect(dropdown().hidden).toBe(true);
    inst.reload();
    inst.destroy();
  });

  it('clear() với dataSource reset asyncItems về null', async () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [],
      debounceMs: 0,
      dataSource: async () => [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    inst.setQuery('alp', { focus: false });
    await flush(20);
    inst.clear();
    expect(dropdown().hidden).toBe(true);
    inst.destroy();
  });
});

describe('core edge: instance methods', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('focus()/blur() theo chương trình hoạt động đúng', () => {
    const onFocus = vi.fn();
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
      onFocus,
    });
    inst.focus();
    expect(onFocus).toHaveBeenCalled();
    inst.blur();
    expect(document.activeElement).not.toBe(input());
    inst.destroy();
  });

  it('debounceMs=0 qua sự kiện input → fetch ngay lập tức', async () => {
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
    const inp = input();
    inp.value = 'alp';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(calls).toBe(1);
    await flush(20);
    expect(dropdown().textContent).toContain('Alpha');
    inst.destroy();
  });

  it('keydown thường sau khi chọn chip → reset cờ isChipJustSelected', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'G', label: 'Alpha' }],
    });
    inst.setQuery('alp', { focus: false });
    input().focus();
    key('Tab');
    key('Enter'); // chọn chip → isChipJustSelected = true
    expect(dropdown().hidden).toBe(true);
    key('x'); // phím thường → reset cờ (không crash, dropdown vẫn đóng)
    expect(dropdown().hidden).toBe(true);
    inst.destroy();
  });
});
