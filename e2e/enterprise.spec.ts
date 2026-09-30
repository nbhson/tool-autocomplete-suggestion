import { test, expect, Page } from '@playwright/test';

test.describe('SAutocomplete — enterprise', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    await page.waitForSelector('#test-host .sa-input');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('exposes screen-reader live region + expanded state', async () => {
    const live = page.locator('#test-host [data-sa="live"]');
    await expect(live).toHaveAttribute('role', 'status');
    await page.locator('#test-host .sa-input').click();
    await page.locator('#test-host .sa-input').fill('typ');
    await expect(page.locator('#test-host .sa-input')).toHaveAttribute('aria-expanded', 'true');
    await expect(live).not.toBeEmpty();
  });

  test('Home/End move chip focus without closing', async () => {
    await page.locator('#test-host .sa-input').click();
    await page.locator('#test-host .sa-input').fill('typ');
    await page.keyboard.press('Tab');
    await page.keyboard.press('End');
    await expect(page.locator('#test-host .sa-chip-focused')).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.locator('#test-host .sa-chip-focused')).toBeVisible();
  });

  test('hidden form input mirrors query when name is set', async () => {
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'form-test';
      document.body.appendChild(host);
      (window as any).formInst = (window as any).SAutocomplete.createAutocomplete({
        container: '#form-test',
        items: [{ id: '1', group: 'Language', label: 'TypeScript' }],
        name: 'q',
      });
      (window as any).formInst.setQuery('hello', { focus: false });
    });
    await expect(page.locator('#form-test input[type="hidden"][name="q"]')).toHaveValue('hello');
    await page.evaluate(() => (window as any).formInst.destroy());
  });

  test('RTL token sets dir + class', async () => {
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'rtl-test';
      document.body.appendChild(host);
      (window as any).rtlInst = (window as any).SAutocomplete.createAutocomplete({
        container: '#rtl-test',
        items: [],
        tokens: { direction: 'rtl' },
      });
    });
    await expect(page.locator('#rtl-test .sa-root')).toHaveAttribute('dir', 'rtl');
    await page.evaluate(() => (window as any).rtlInst.destroy());
  });

  test('async dataSource shows loading then results', async () => {
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'async-test';
      document.body.appendChild(host);
      (window as any).asyncInst = (window as any).SAutocomplete.createAutocomplete({
        container: '#async-test',
        items: [],
        debounceMs: 0,
        dataSource: ({ query }: { query: string }) =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                query.startsWith('rea')
                  ? [{ id: '1', group: 'Framework', label: 'React' }]
                  : [],
              );
            }, 50);
          }),
      });
      (window as any).asyncInst.setQuery('rea', { focus: false });
    });
    await expect(page.locator('#async-test .sa-loading')).toBeVisible();
    await expect(page.locator('#async-test .sa-chip').first()).toContainText('React', { timeout: 3000 });
    await page.evaluate(() => (window as any).asyncInst.destroy());
  });

  test('malicious submitIcon is neutralized', async () => {
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'xss-test';
      document.body.appendChild(host);
      (window as any).xssInst = (window as any).SAutocomplete.createAutocomplete({
        container: '#xss-test',
        items: [],
        submitIcon: '<img src=x onerror=alert(1)>',
      });
    });
    expect(await page.locator('#xss-test .sa-submit img').count()).toBe(0);
    await page.evaluate(() => (window as any).xssInst.destroy());
  });
});
