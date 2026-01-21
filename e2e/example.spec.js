// e2e/hotel-manage.spec.js
const { test, expect } = require('@playwright/test');

test('进入酒店管理后台', async ({ page }) => {
  // 此时浏览器已经带有登录成功的 Cookies
  await page.goto('http://localhost:9011/Dash-board');

  // 直接验证已登录后的内容
  await expect(page.getByText('meeting_room 房间状态概览')).toBeVisible();
});

