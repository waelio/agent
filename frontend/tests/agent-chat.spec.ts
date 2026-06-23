import { test, expect } from '@playwright/test';

test.describe('Agent Frontend', () => {
  test('has title and drawer', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/@waelio\/agent/);

    // Expect the drawer title to be visible.
    const drawerTitle = page.locator('.drawer-title');
    await expect(drawerTitle).toBeVisible();
    await expect(drawerTitle).toHaveText('@waelio/agent');
  });

  test('social tab shows links', async ({ page }) => {
    await page.goto('/social');

    await expect(page).toHaveTitle(/Social/);
    await expect(page.locator('.social-title')).toHaveText('Social');
    await expect(page.locator('.social-link')).toHaveCount(4);
    await expect(page.locator('a.social-link[href="https://waelio.com/chat"]')).toBeVisible();
    await expect(page.locator('#form')).toBeHidden();
  });
});
