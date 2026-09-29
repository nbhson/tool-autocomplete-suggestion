import { test, expect, Page } from '@playwright/test';

test.describe('SAutocomplete Suggestion - E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    await page.waitForSelector('#test-host .sa-input');
    await page.waitForFunction(
      () => {
        const log = document.getElementById('event-log');
        return log && log.textContent?.includes('onReady fired');
      },
      { timeout: 5000 },
    );
  });

  test.afterEach(async () => {
    await page.close();
  });

  const inputSelector = '#test-host .sa-input';
  const dropdownSelector = '#test-host .sa-dropdown';
  const chipSelector = '#test-host .sa-chip';

  test.describe('Initialization', () => {
    test('should render input with placeholder and action buttons', async () => {
      await expect(page.locator('#test-host .sa-root')).toBeVisible();
      await expect(page.locator(inputSelector)).toBeVisible();
      await expect(page.locator(inputSelector)).toHaveAttribute('placeholder', 'Search here...');
      await expect(page.locator('#test-host .sa-submit')).toBeVisible();
    });

    test('should expose instance on window', async () => {
      const ok = await page.evaluate(
        () =>
          typeof (window as any).autocomplete === 'object' &&
          typeof (window as any).autocomplete.getQuery === 'function',
      );
      expect(ok).toBe(true);
    });

    test('should fire onReady event', async () => {
      const log = await page.locator('#event-log').textContent();
      expect(log).toContain('onReady fired');
    });

    test('should expose combobox/listbox ARIA roles', async () => {
      await expect(page.locator(inputSelector)).toHaveAttribute('role', 'combobox');
      await expect(page.locator(inputSelector)).toHaveAttribute('aria-autocomplete', 'list');
      const controls = await page.locator(inputSelector).getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      await expect(page.locator(`#${controls}`)).toHaveAttribute('role', 'listbox');
    });

    test('should label clear and submit buttons', async () => {
      await expect(page.locator('#test-host .sa-clear')).toHaveAttribute('aria-label', 'Clear');
      await expect(page.locator('#test-host .sa-submit')).toHaveAttribute('aria-label', 'Search');
    });
  });

  test.describe('History', () => {
    test('should show recent history when focused with empty input', async () => {
      await page.locator(inputSelector).click();
      await expect(page.locator(dropdownSelector)).toBeVisible();
      await expect(page.locator('#test-host .sa-history').first()).toContainText('TypeScript with React');
    });

    test('should submit when a history entry is clicked', async () => {
      await page.locator(inputSelector).click();
      await page.locator('#test-host .sa-history').first().click();
      const log = await page.locator('#event-log').textContent();
      expect(log).toContain('onSubmit: TypeScript with React');
    });
  });

  test.describe('Suggestions filtering', () => {
    test('should filter grouped suggestions while typing', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await expect(page.locator(dropdownSelector)).toBeVisible();
      await expect(page.locator(chipSelector).first()).toContainText('TypeScript');
      await expect(page.locator('#test-host .sa-group')).toHaveAttribute('aria-label', 'Language');
    });

    test('should mark chips as options with aria-selected', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      const chip = page.locator(chipSelector).first();
      await expect(chip).toHaveAttribute('role', 'option');
      await expect(chip).toHaveAttribute('aria-selected', 'false');
    });

    test('should show status bar with hits info', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      const status = page.locator('#test-host .sa-status');
      await expect(status).toBeVisible();
      await expect(status).toHaveAttribute('role', 'status');
      await expect(status).toContainText('hits');
    });

    test('should hide dropdown when there is no match', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('zzz-no-match');
      await expect(page.locator(dropdownSelector)).toBeHidden();
    });
  });

  test.describe('Staged multi-select', () => {
    test('should stage a chip with Space and apply with Enter (no submit yet)', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await page.keyboard.press('Tab');
      await page.keyboard.press(' ');
      await expect(page.locator('#test-host .sa-staged')).toContainText('Selected: 1');
      await page.keyboard.press('Enter');
      await expect(page.locator(inputSelector)).toHaveValue('TypeScript');
      const log = await page.locator('#event-log').textContent();
      expect(log).not.toContain('onSubmit: TypeScript');
    });

    test('should stage via chip click and Apply button', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('vit');
      await page.locator(chipSelector).first().click();
      await expect(page.locator('#test-host .sa-staged')).toContainText('Selected: 1');
      await page.locator('#test-host .sa-apply').click();
      await expect(page.locator(inputSelector)).toHaveValue('Vite');
    });

    test('full flow: stage then Enter on input submits', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await page.keyboard.press('Tab');
      await page.keyboard.press(' ');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      const log = await page.locator('#event-log').textContent();
      expect(log).toContain('onSubmit: TypeScript');
    });
  });

  test.describe('Keyboard', () => {
    test('should close dropdown on Escape', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await expect(page.locator(dropdownSelector)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(dropdownSelector)).toBeHidden();
    });

    test('should expand combobox state while open', async () => {
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await expect(page.locator(inputSelector)).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(page.locator(dropdownSelector)).toBeHidden();
    });
  });

  test.describe('Public API', () => {
    test('getQuery/setQuery/clear', async () => {
      await page.evaluate(() => (window as any).autocomplete.setQuery('Vue', { focus: false }));
      await expect(page.locator(inputSelector)).toHaveValue('Vue');
      const q = await page.evaluate(() => (window as any).autocomplete.getQuery());
      expect(q).toBe('Vue');
      await page.evaluate(() => (window as any).autocomplete.clear());
      await expect(page.locator(inputSelector)).toHaveValue('');
    });

    test('getText/isEmpty/getCharacterCount/getWordCount', async () => {
      expect(await page.evaluate(() => (window as any).autocomplete.isEmpty())).toBe(true);
      expect(await page.evaluate(() => (window as any).autocomplete.getWordCount())).toBe(0);
      await page.evaluate(() => (window as any).autocomplete.setQuery('React Vite', { focus: false }));
      expect(await page.evaluate(() => (window as any).autocomplete.getText())).toBe('React Vite');
      expect(await page.evaluate(() => (window as any).autocomplete.getCharacterCount())).toBe(10);
      expect(await page.evaluate(() => (window as any).autocomplete.getWordCount())).toBe(2);
    });

    test('setItems updates suggestions dynamically', async () => {
      await page.evaluate(() =>
        (window as any).autocomplete.setItems([{ id: '1', group: 'Movie', label: 'Dune' }]),
      );
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('du');
      await expect(page.locator(chipSelector).first()).toContainText('Dune');
    });

    test('disable/enable', async () => {
      await page.evaluate(() => (window as any).autocomplete.disable());
      await expect(page.locator(inputSelector)).toBeDisabled();
      await page.evaluate(() => (window as any).autocomplete.enable());
      await expect(page.locator(inputSelector)).toBeEnabled();
    });

    test('custom color and submit icon', async () => {
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'custom-test';
        document.body.appendChild(host);
        (window as any).customInst = (window as any).SAutocomplete.createAutocomplete({
          container: '#custom-test',
          items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
          color: '#7c3aed',
          colorDark: '#5b21b6',
          submitIcon: '<svg data-testid="custom-submit"></svg>',
        });
      });
      const accent = await page.evaluate(() =>
        ((window as any).customInst.getElement() as HTMLElement).style.getPropertyValue('--sa-accent'),
      );
      expect(accent).toBe('#7c3aed');
      await expect(page.locator('#custom-test .sa-submit svg[data-testid="custom-submit"]')).toBeVisible();
      await page.evaluate(() => (window as any).customInst.destroy());
    });

    test('getElement returns root element', async () => {
      const ok = await page.evaluate(() => {
        const el = (window as any).autocomplete.getElement();
        return el.classList.contains('sa-root');
      });
      expect(ok).toBe(true);
    });

    test('destroy removes the component', async () => {
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'destroy-test';
        document.body.appendChild(host);
        const inst = (window as any).SAutocomplete.createAutocomplete({
          container: '#destroy-test',
          items: [],
        });
        inst.destroy();
      });
      expect(await page.locator('#destroy-test .sa-root').count()).toBe(0);
    });
  });

  test.describe('Focus/Blur Events', () => {
    test('should fire onFocus when input is clicked', async () => {
      await page.evaluate(() => {
        document.getElementById('event-log')!.textContent = '';
      });
      await page.locator(inputSelector).click();
      await page.waitForTimeout(100);
      expect(await page.locator('#event-log').textContent()).toContain('onFocus fired');
    });

    test('should fire onBlur when clicking outside', async () => {
      await page.locator(inputSelector).click();
      await page.evaluate(() => {
        document.getElementById('event-log')!.textContent = '';
      });
      await page.locator('h1').click();
      await page.waitForTimeout(100);
      expect(await page.locator('#event-log').textContent()).toContain('onBlur fired');
    });
  });

  test.describe('onChange Event', () => {
    test('should fire onChange when typing', async () => {
      await page.evaluate(() => {
        document.getElementById('event-log')!.textContent = '';
      });
      await page.locator(inputSelector).click();
      await page.locator(inputSelector).fill('typ');
      await page.waitForTimeout(100);
      expect(await page.locator('#event-log').textContent()).toContain('onChange: typ');
    });
  });
});
