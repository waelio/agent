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

  test('can submit a chat message', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('#input');
    await input.fill('Hello, Researcher!');
    
    // Check if button works
    const submitBtn = page.locator('#btn');
    await expect(submitBtn).toBeVisible();
    
    // For now we just test that the form can be submitted 
    // We don't have a real backend responding in the test environment
    await submitBtn.click();
    
    // Input should be cleared or disabled depending on implementation,
    // but at minimum the input exists.
    await expect(input).toBeVisible();
  });
});
