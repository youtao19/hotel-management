// e2e/order-manage/check_in.spec.js
const { test, expect } = require('@playwright/test');
const { checkIn } = require('../tool');



test.describe('办理入住测试', () => {

  test('办理入住流程', async ({ page }) => {
    await checkIn(page);
  });

});
