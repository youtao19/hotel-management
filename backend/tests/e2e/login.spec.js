// @ts-check
import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL || 'wuyoutao19@qq.com';
const password = process.env.E2E_PASSWORD || 'wyt.1219';
const baseURL = process.env.FRONTEND_URL || 'http://localhost:9001';

test.describe('登录', () => {
  test('成功登录后进入仪表盘', async ({ browser }) => {
    test.skip(!email || !password, '请设置环境变量 E2E_EMAIL 与 E2E_PASSWORD 后再运行该用例');

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto('/login');

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: '登录' }).click();

    await page.waitForURL('**/Dash-board', { timeout: 15_000 });
    await expect(page.getByText('房间状态概览')).toBeVisible();

    await context.close();
  });
});
