import { describe, it, expect } from 'vitest';
import { escapeHTML, escapeAttr } from './sanitizer';

describe('escapeHTML', () => {
  it('escapes angle brackets, quotes and ampersands', () => {
    expect(escapeHTML('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHTML("it's & <b>bold</b>")).toBe('it&#39;s &amp; &lt;b&gt;bold&lt;/b&gt;');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(escapeHTML('')).toBe('');
    expect(escapeHTML(undefined as unknown as string)).toBe('');
  });

  it('leaves plain labels untouched', () => {
    expect(escapeHTML('TypeScript')).toBe('TypeScript');
    expect(escapeHTML('Phòng khám đa khoa')).toBe('Phòng khám đa khoa');
  });
});

describe('escapeAttr', () => {
  it('escapes backticks in addition to HTML chars', () => {
    expect(escapeAttr('a`b"c')).toBe('a&#96;b&quot;c');
  });
});
