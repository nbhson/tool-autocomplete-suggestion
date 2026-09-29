import { describe, it, expect, beforeEach } from 'vitest';
import { createAutocomplete } from './index';

describe('createAutocomplete core', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders input with placeholder', () => {
    const inst = createAutocomplete({ container: '#host', placeholder: 'Search here...' });
    const input = document.querySelector('.sa-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Search here...');
    inst.destroy();
  });

  it('opens history when focused with empty input', () => {
    const inst = createAutocomplete({ container: '#host', history: ['TypeScript with React'] });
    const input = document.querySelector('.sa-input') as HTMLInputElement;
    input.focus();
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(false);
    expect(dd.textContent).toContain('Recent searches');
    inst.destroy();
  });

  it('shows grouped suggestions when typing', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'Language', label: 'TypeScript' },
        { id: '2', group: 'Framework', label: 'React' },
      ],
    });
    inst.setQuery('typ');
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.hidden).toBe(false);
    expect(dd.textContent).toContain('TypeScript');
    inst.destroy();
  });

  it('setQuery/getQuery/submit flow', () => {
    let submitted = '';
    const inst = createAutocomplete({ container: '#host', onSubmit: (q) => (submitted = q) });
    inst.setQuery('TypeScript', { focus: false });
    expect(inst.getQuery()).toBe('TypeScript');
    inst.submit();
    expect(submitted).toBe('TypeScript');
    inst.destroy();
  });

  it('dynamic setItems updates suggestions', () => {
    const inst = createAutocomplete({ container: '#host', items: [] });
    inst.setItems([{ id: '1', group: 'Framework', label: 'Vue' }]);
    expect(inst.getItems().length).toBe(1);
    inst.destroy();
  });

  it('text metrics: getText/isEmpty/getCharacterCount/getWordCount', () => {
    const inst = createAutocomplete({ container: '#host' });
    expect(inst.isEmpty()).toBe(true);
    expect(inst.getWordCount()).toBe(0);
    expect(inst.getCharacterCount()).toBe(0);
    inst.setQuery('React Vite', { focus: false });
    expect(inst.getText()).toBe('React Vite');
    expect(inst.isEmpty()).toBe(false);
    expect(inst.getCharacterCount()).toBe(10);
    expect(inst.getWordCount()).toBe(2);
    inst.destroy();
  });

  it('exposes ARIA roles (combobox/listbox/status) and button labels', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
    });
    const input = document.querySelector('.sa-input') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBeTruthy();
    const listboxId = input.getAttribute('aria-controls')!;
    expect(document.getElementById(listboxId)?.getAttribute('role')).toBe('listbox');
    expect(
      (document.querySelector('.sa-clear') as HTMLElement).getAttribute('aria-label'),
    ).toBeTruthy();
    expect(
      (document.querySelector('.sa-submit') as HTMLElement).getAttribute('aria-label'),
    ).toBeTruthy();
    inst.setQuery('typ', { focus: false });
    const chip = document.querySelector('.sa-chip') as HTMLElement;
    expect(chip.getAttribute('role')).toBe('option');
    expect(chip.getAttribute('aria-selected')).toBeTruthy();
    expect(document.querySelector('.sa-status')?.getAttribute('role')).toBe('status');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    inst.destroy();
  });

  it('applies custom accent color via CSS variables', () => {
    const inst = createAutocomplete({ container: '#host', color: '#7c3aed', colorDark: '#5b21b6' });
    const root = inst.getElement();
    expect(root.style.getPropertyValue('--sa-accent')).toBe('#7c3aed');
    expect(root.style.getPropertyValue('--sa-accent-dark')).toBe('#5b21b6');
    inst.destroy();
  });

  it('applies custom border radius via CSS variable', () => {
    const inst = createAutocomplete({ container: '#host', borderRadius: 12 });
    expect(inst.getElement().style.getPropertyValue('--sa-radius')).toBe('12px');
    inst.setBorderRadius('999px');
    expect(inst.getElement().style.getPropertyValue('--sa-radius')).toBe('999px');
    inst.setBorderRadius(8);
    expect(inst.getElement().style.getPropertyValue('--sa-radius')).toBe('8px');
    inst.destroy();
  });

  it('Tab/Arrow navigation updates focus without full dropdown rebuild (no flicker)', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [
        { id: '1', group: 'Language', label: 'TypeScript' },
        { id: '2', group: 'Language', label: 'TypoScript' },
      ],
    });
    inst.setQuery('typ', { focus: false });
    const input = document.querySelector('.sa-input') as HTMLInputElement;
    input.focus();
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    const panelBefore = dd.querySelector('.sa-panel') as HTMLElement;
    expect(panelBefore).toBeTruthy();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    // Same panel element must survive (no innerHTML rebuild) and gain focused chip
    const panelAfter = dd.querySelector('.sa-panel') as HTMLElement;
    expect(panelAfter).toBe(panelBefore);
    expect(dd.querySelector('.sa-chip-focused')).toBeTruthy();
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-');
    const chipCountBefore = dd.querySelectorAll('.sa-chip').length;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(dd.querySelector('.sa-panel')).toBe(panelBefore);
    expect(dd.querySelectorAll('.sa-chip').length).toBe(chipCountBefore);
    inst.destroy();
  });

  it('renders a custom submit icon', () => {
    const inst = createAutocomplete({
      container: '#host',
      submitIcon: '<svg data-testid="custom-submit"></svg>',
    });
    const btn = document.querySelector('.sa-submit') as HTMLElement;
    expect(btn.innerHTML).toContain('data-testid="custom-submit"');
    inst.destroy();
  });

  it('escapes malicious labels (XSS-safe rendering)', () => {
    const inst = createAutocomplete({
      container: '#host',
      items: [{ id: 'x', group: 'Language', label: '<img src=x onerror=alert(1)>' }],
    });
    inst.setQuery('<img', { focus: false });
    const dd = document.querySelector('.sa-dropdown') as HTMLElement;
    expect(dd.querySelector('img')).toBeNull();
    expect(dd.innerHTML).toContain('&lt;img');
    inst.destroy();
  });
});
