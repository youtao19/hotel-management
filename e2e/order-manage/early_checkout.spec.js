// e2e/order-manage/early_checkout.spec.js
const { test, expect } = require('@playwright/test');
const { checkIn, filterOrdersByKeyword } = require('../tool');

test.describe('提前退房测试', () => {
  test('提前退房流程', async ({ page }) => {
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

    // 点击该行的“提前退房”按钮
    await checkedInRow.getByTestId('orders-row-early-checkout').click();

    // 等待提前退房弹窗显示
    await expect(page.getByText('提前退房')).toBeVisible();

    // 等待按钮可点击后提交
    const confirmButton = page.getByRole('button', { name: '确认提前退房' });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 验证提前退房成功通知（兼容两种提示文案）
    const successNotify = page.locator('.q-notification').filter({
      hasText: /提前退房(已完成|成功)/
    });
    await expect(successNotify).toBeVisible();
  });
});
