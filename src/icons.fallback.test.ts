import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeSvgMarkup, sanitizeSvgMarkup } from './icons';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sanitizeSvgMarkup — fallbackStrip (không có DOMParser / DOMParser lỗi)', () => {
  it('dùng regex fallback khi DOMParser không tồn tại (SSR)', () => {
    vi.stubGlobal('DOMParser', undefined);
    const out = sanitizeSvgMarkup(
      '<svg width="16" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    );
    expect(out).toContain('<svg');
    expect(out).toContain('<path d="M5 12h14"');
  });

  it('fallback loại bỏ <script>, thuộc tính on*, href và javascript:', () => {
    vi.stubGlobal('DOMParser', undefined);
    const out = sanitizeSvgMarkup(
      '<svg><script>alert(1)</script><a xlink:href="javascript:alert(1)"><path d="M1 1" onclick="evil()" href="https://x"/></a></svg>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('href');
    expect(out).not.toContain('onclick');
    expect(out).toContain('<path d="M1 1"');
  });

  it('fallback bắt khối svg tự đóng (<svg/>)', () => {
    vi.stubGlobal('DOMParser', undefined);
    const out = sanitizeSvgMarkup('<svg width="10"/>');
    expect(out).toBe('<svg width="10"/>');
  });

  it('fallback trả về rỗng khi không còn khối svg nào', () => {
    vi.stubGlobal('DOMParser', undefined);
    expect(sanitizeSvgMarkup('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('fallback giới hạn đầu ra tối đa 4000 ký tự', () => {
    vi.stubGlobal('DOMParser', undefined);
    const long = `<svg>${'<path d="M1 1"/>'.repeat(500)}</svg>`;
    const out = sanitizeSvgMarkup(long);
    expect(out.length).toBeLessThanOrEqual(4000);
  });

  it('chuyển sang fallback khi DOMParser.parseFromString ném lỗi', () => {
    class BrokenParser {
      parseFromString(): Document {
        throw new Error('parser exploded');
      }
    }
    vi.stubGlobal('DOMParser', BrokenParser);
    const out = sanitizeSvgMarkup('<svg><path d="M2 2"/></svg>');
    expect(out).toContain('<svg');
    expect(out).toContain('<path d="M2 2"');
  });

  it('trả về rỗng cho markup rỗng / không phải chuỗi', () => {
    expect(sanitizeSvgMarkup('')).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeSvgMarkup(undefined as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeSvgMarkup(123 as any)).toBe('');
  });
});

describe('sanitizeSvgMarkup — nhánh DOMParser', () => {
  it('unwrap thẻ không cho phép nhưng giữ con an toàn', () => {
    const out = sanitizeSvgMarkup(
      '<svg><g><a href="https://evil"><path d="M1 1"/></a></g></svg>',
    );
    expect(out).not.toContain('<a');
    expect(out).toContain('<path d="M1 1"');
    expect(out).toContain('<g>');
  });

  it('bỏ text node bên trong icon', () => {
    const out = sanitizeSvgMarkup('<svg>noise text<path d="M1 1"/></svg>');
    expect(out).not.toContain('noise');
    expect(out).toContain('<path d="M1 1"');
  });

  it('giữ thuộc tính data-* (inert) và bỏ thuộc tính lạ', () => {
    const out = sanitizeSvgMarkup('<svg data-testid="icon" foo="bar"><path d="M1 1"/></svg>');
    expect(out).toContain('data-testid="icon"');
    expect(out).not.toContain('foo=');
  });

  it('giữ fill/stroke rỗng nhưng bỏ attr an toàn khác có giá trị nguy hiểm', () => {
    const out = sanitizeSvgMarkup(
      '<svg fill="javascript:alert(1)" stroke="onload=x"><path d="M1 1"/></svg>',
    );
    expect(out).toContain('fill=""');
    expect(out).toContain('stroke=""');
  });

  it('giữ giá trị fill/stroke hợp lệ', () => {
    const out = sanitizeSvgMarkup('<svg fill="red" stroke="blue"><path d="M1 1"/></svg>');
    expect(out).toContain('fill="red"');
    expect(out).toContain('stroke="blue"');
  });

  it('giá trị attr chứa javascript: / on*= / <script bị làm rỗng', () => {
    const out = sanitizeSvgMarkup(
      '<svg><path d="M1 1" transform="javascript:alert(1)"/></svg>',
    );
    expect(out).not.toContain('javascript:');
    const out2 = sanitizeSvgMarkup('<svg><path d="M1 1" transform="onerror=x"/></svg>');
    expect(out2).not.toContain('onerror');
    const out3 = sanitizeSvgMarkup('<svg><path d="M1 1" transform="<script>x</script>"/></svg>');
    expect(out3).not.toContain('<script');
  });

  it('markup chỉ chứa thẻ không cho phép → rỗng', () => {
    expect(sanitizeSvgMarkup('<iframe src="x"></iframe>')).toBe('');
    expect(isSafeSvgMarkup('<b>bold</b>')).toBe(false);
  });
});
