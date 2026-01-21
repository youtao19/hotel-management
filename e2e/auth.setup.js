// e2e/auth.setup.js
const { test: setup, expect } = require('@playwright/test');
const path = require('path');

// 定义存储状态文件的路径
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('登录并保存状态', async ({ page }) => {
  // 1. 访问登录页面
  await page.goto('http://localhost:9011/login');

  // 2. 输入账号密码 (使用你 .env.test 中的环境变量)
  // 假设你的 Quasar 登录页使用了这些选择器
  await page.getByLabel('邮箱').fill(process.env.E2E_EMAIL);
  await page.getByLabel('密码').fill(process.env.E2E_PASSWORD);

  // 3. 点击登录按钮
  await page.getByRole('button', { name: '登录' }).click();

  // 4. 等待页面跳转到首页或仪表盘，确保登录成功
  await expect(page).toHaveURL('http://localhost:9011/Dash-board');

  // 如果 setup 脚本保存状态太快，有些 LocalStorage 可能还没存进去
  await page.waitForLoadState('networkidle');

  // 5. 将当前的 Cookies 和 LocalStorage 保存到文件
  await page.context().storageState({ path: authFile });
});
