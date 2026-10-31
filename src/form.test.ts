import { describe, it, expect } from 'vitest';
import { createHiddenInput } from './form';

describe('createHiddenInput', () => {
  it('creates a hidden, named input carrying the initial value', () => {
    const el = createHiddenInput('query', 'react vite');
    expect(el.type).toBe('hidden');
    expect(el.name).toBe('query');
    expect(el.value).toBe('react vite');
    expect(el.getAttribute('data-sa')).toBe('form-value');
  });

  it('is excluded from tab order and accessibility tree', () => {
    const el = createHiddenInput('q', '');
    expect(el.tabIndex).toBe(-1);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
