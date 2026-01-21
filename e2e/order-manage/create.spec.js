// e2e/order-manage/create.spec.js
const { test, expect } = require('@playwright/test');

const {
  createOrder,
  createMultiDayOrder,
  createRestOrder,
} = require('../tool');

test.describe('订单创建测试', () => {

  test('单日订单', async ({ page }) => {
    // 此时浏览器已经带有登录成功的 Cookies
    await page.goto('http://localhost:9011/Dash-board');
    await createOrder(page);
  });

  test('多日订单', async ({ page }) => {
    await createMultiDayOrder(page);
  });

  test('休息房订单', async ({ page }) => {
    await createRestOrder(page);
  });

});
