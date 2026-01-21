// e2e/login-page.spec.js
const { test, expect } = require('@playwright/test');

test('登录页基础元素可见', async ({ page }) => {
  // 进入登录页
  await page.goto('/login');

  // 校验邮箱输入框可见
  await expect(page.getByLabel('邮箱')).toBeVisible();

  // 校验密码输入框可见
  await expect(page.getByLabel('密码')).toBeVisible();

  // 校验登录按钮可见
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
});
