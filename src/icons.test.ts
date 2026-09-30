import { describe, it, expect } from 'vitest';
import { sanitizeSvgMarkup, isSafeSvgMarkup } from './icons';

describe('sanitizeSvgMarkup', () => {
  it('keeps safe svg/path markup', () => {
    const out = sanitizeSvgMarkup(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>',
    );
    expect(out).toContain('<svg');
    expect(out).toContain('<path');
    expect(isSafeSvgMarkup(out)).toBe(true);
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeSvgMarkup('<svg onload="alert(1)"><path d="M1 1"/></svg>');
    expect(out).not.toContain('onload');
    expect(out).toContain('<svg');
  });

  it('strips script tags and javascript: urls', () => {
    const out = sanitizeSvgMarkup('<svg><script>alert(1)</script><path d="M1 1"/></svg>');
    expect(out).not.toContain('<script');
    expect(sanitizeSvgMarkup('<svg><a href="javascript:alert(1)">x</a></svg>')).not.toContain('javascript:');
  });

  it('returns empty for non-svg garbage', () => {
    expect(sanitizeSvgMarkup('<img src=x onerror=alert(1)>')).toBe('');
    expect(isSafeSvgMarkup('<img src=x>')).toBe(false);
  });
});
