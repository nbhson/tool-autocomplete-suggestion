import { describe, it, expect } from 'vitest';
import { themeForGroup, GROUP_THEME_ORDER } from './themes';

describe('themeForGroup', () => {
  it('returns a theme for every known group', () => {
    for (const name of GROUP_THEME_ORDER) {
      const th = themeForGroup(name);
      expect(th.bg).toMatch(/^#/);
      expect(th.text).toMatch(/^#/);
      expect(th.border).toMatch(/^#/);
      expect(th.dot).toMatch(/^#/);
    }
  });

  it('falls back to slate for unknown groups', () => {
    const th = themeForGroup('Movie');
    expect(th).toEqual({ bg: '#f1f5f9', text: '#334155', border: '#e2e8f0', dot: '#64748b' });
  });

  it('is deterministic for the same input', () => {
    expect(themeForGroup('Language')).toEqual(themeForGroup('Language'));
  });
});
