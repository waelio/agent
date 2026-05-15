import { test, expect } from '@playwright/test';

test.describe('Agent Frontend', () => {
  test('has title and drawer', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/AI Researcher/);

    // Expect the drawer title to be visible.
    const drawerTitle = page.locator('.drawer-title');
    await expect(drawerTitle).toBeVisible();
    await expect(drawerTitle).toHaveText('gemma.4');
  });

  test('can configure backend URL', async ({ page }) => {
    await page.goto('/');

    const backendInput = page.locator('#backend-url');
    await expect(backendInput).toBeVisible();

    // Fill in a test backend URL
    await backendInput.fill('https://test-api.example.com');
    await page.locator('#backend-save').click();

    // The status should update
    const status = page.locator('#backend-status');
    await expect(status).toBeVisible();
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
