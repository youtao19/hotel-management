// @ts-check
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

module.exports = async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  const baseURL = process.env.FRONTEND_URL || 'http://localhost:9000';

  if (!email || !password) {
    throw new Error('缺少 E2E_EMAIL / E2E_PASSWORD，无法生成 storageState');
  }

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const statePath = path.join(repoRoot, 'playwright', '.auth', 'state.json');

  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/Dash-board', { timeout: 30_000 });

  await context.storageState({ path: statePath });
  await browser.close();
};

