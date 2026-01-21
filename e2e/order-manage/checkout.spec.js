// e2e/order-manage/checkout.spec.js
const { test, expect } = require('@playwright/test');
const { checkIn, filterOrdersByKeyword } = require('../tool');

test.describe('办理退房测试', () => {
  test('办理退房流程', async ({ page }) => {
    // 先创建并办理入住订单，获取可筛选的客人姓名
    const { guestName } = await checkIn(page);

    // 通过搜索筛选到当前订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 等待出现“已入住”的订单行
    const checkedInRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '已入住' }) })
      .first();
    await expect(checkedInRow).toBeVisible();

    // 点击该行的“办理退房”按钮
    await checkedInRow.getByTestId('orders-row-checkout').click();

    // 确认退房弹窗
    await expect(page.getByText('确认退房')).toBeVisible();
    await page.getByRole('button', { name: '确定' }).click();

    // 验证退房成功通知
    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '退房成功'
    });
    await expect(successNotify).toBeVisible();
  });
});
