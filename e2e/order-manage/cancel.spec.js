// e2e/order-manage/cancel.spec.js
const { test, expect } = require('@playwright/test');
const { createOrder, checkIn, filterOrdersByKeyword } = require('../tool');

test.describe('取消订单测试', () => {

  test('取消待入住订单', async ({ page }) => {
    const { guestName } = await createOrder(page);

    // 订单创建成功后会跳转到订单详情页
    await expect(page.getByText('订单列表')).toBeVisible();

    // 根据创建的客人姓名筛选订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 等待出现“待入住”的订单行，避免筛选下拉卡住
    const pendingRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '待入住' }) })
      .first();
    await expect(pendingRow).toBeVisible();

    // 点击该行的“取消订单”按钮（有稳定的 data-testid）
    await pendingRow.getByTestId('orders-row-cancel').click();

    await expect(page.getByText('确认取消')).toBeVisible();


    await page.getByRole('button', { name: '确定' }).click();

    // 验证取消订单成功的通知
    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单已取消'
    });

    await expect(successNotify).toBeVisible();
  });

  test('取消已入住订单', async ({ page }) => {
    const { guestName } = await checkIn(page);

    // 根据创建的客人姓名筛选订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 等待出现“已入住”的订单行，避免筛选下拉卡住
    const checkedInRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '已入住' }) })
      .first();
    await expect(checkedInRow).toBeVisible();

    // 点击该行的“取消订单”按钮（有稳定的 data-testid）
    await checkedInRow.getByTestId('orders-row-cancel').click();

    await expect(page.getByText('确认取消')).toBeVisible();

    await page.getByRole('button', { name: '确定' }).click();

    // 验证取消订单成功的通知
    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单已取消'
    });

    await expect(successNotify).toBeVisible();
  });

});
