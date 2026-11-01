import { test, expect, Page } from '@playwright/test';

/**
 * A11y E2E — xác minh pattern ARIA combobox (WAI-ARIA 1.2) trên trình duyệt thật:
 * role=combobox, aria-expanded, aria-controls → role=listbox, option + aria-selected,
 * aria-activedescendant khi điều hướng bàn phím, live region role=status.
 */
test.describe('SAutocomplete Suggestion - A11y', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    await page.waitForSelector('#test-host .sa-input');
  });

  test.afterEach(async () => {
    await page.close();
  });

  const inputSelector = '#test-host .sa-input';

  test('input có đầy đủ thuộc tính combobox khi khởi tạo', async () => {
    const input = page.locator(inputSelector);
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-controls');
    await expect(input).toHaveAttribute('aria-describedby');
    const describedBy = await input.getAttribute('aria-describedby');
    const live = page.locator(`#${describedBy}`);
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveAttribute('aria-live', 'polite');
  });

  test('mở dropdown → aria-expanded=true, listbox ẩn/hiện đúng', async () => {
    const input = page.locator(inputSelector);
    const controls = await input.getAttribute('aria-controls');
    await input.click();
    await input.fill('typ');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = page.locator(`#${controls}`);
    await expect(listbox).toHaveAttribute('role', 'listbox');
    await expect(listbox).toBeVisible();
    const options = listbox.locator('[role="option"]');
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toHaveAttribute('id');
  });

  test('Tab/Arrow cập nhật aria-activedescendant; Escape đóng thì xoá', async () => {
    const input = page.locator(inputSelector);
    await input.click();
    await input.fill('t'); // nhiều chip để điều hướng
    await input.press('Tab');
    await expect(input).toHaveAttribute('aria-activedescendant', /.+-opt-\d+/);
    const activeId = await input.getAttribute('aria-activedescendant');
    await expect(page.locator(`#${activeId}`)).toHaveAttribute('aria-selected', 'true');
    await input.press('ArrowDown');
    const activeId2 = await input.getAttribute('aria-activedescendant');
    expect(activeId2).not.toBe(activeId);
    await expect(page.locator(`#${activeId2}`)).toHaveClass(/sa-chip-focused/);
    // Escape bỏ focus chip → xoá activedescendant
    await input.press('Escape');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  test('live region announce số kết quả khi có gợi ý', async () => {
    const input = page.locator(inputSelector);
    const describedBy = await input.getAttribute('aria-describedby');
    const live = page.locator(`#${describedBy}`);
    await input.click();
    await input.fill('typ');
    await expect(live).toContainText(/hits/);
  });

  test('chip disabled có aria-disabled và không stage được', async () => {
    // trang test không có item disabled — kiểm chứng bằng evaluate thêm item
    const ok = await page.evaluate(() => {
      const ac = (window as unknown as { autocomplete: { setItems: (i: unknown[]) => void } })
        .autocomplete;
      ac.setItems([{ id: 'd1', group: 'Tool', label: 'Locked', disabled: true }]);
      return true;
    });
    expect(ok).toBe(true);
    await page.locator(inputSelector).click();
    await page.locator(inputSelector).fill('lock');
    const chip = page.locator('#test-host .sa-chip').first();
    await expect(chip).toHaveAttribute('aria-disabled', 'true');
    await expect(chip).toBeDisabled();
  });
});
