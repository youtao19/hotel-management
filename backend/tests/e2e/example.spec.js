// @ts-check
import { test, expect } from '@playwright/test';

test('登录页可正常打开', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('员工登录')).toBeVisible();
});
