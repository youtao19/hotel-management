// e2e/order-manage/check_in.spec.js
const { test, expect } = require('@playwright/test');
const { createOrder } = require('../tool');

test.describe('办理入住测试', () => {

  test('办理入住流程', async ({ page }) => {
    await createOrder(page);

    // 订单创建成功后会跳转到订单详情页
    await expect(page.getByText('订单列表')).toBeVisible();

    // 等待出现“待入住”的订单行，避免筛选下拉卡住
    const pendingRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '待入住' }) })
      .first();
    await expect(pendingRow).toBeVisible();

    // 点击该行的“办理入住”按钮（有稳定的 data-testid）
    await pendingRow.getByTestId('orders-row-check-in').click();

    // 在弹出的办理入住对话框中，填写押金等信息
    await page.getByTestId('checkin-deposit').fill('100');
    await page.getByRole('button', { name: '确认办理入住' }).click();

    // 验证办理入住成功的通知
    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '入住成功'
    });

    await expect(successNotify).toBeVisible();

  });

});
