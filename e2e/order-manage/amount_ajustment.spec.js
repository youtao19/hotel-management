const { test , expect } = require('@playwright/test');

const {
  checkIn,
  filterOrdersByKeyword
} = require('../tool');


test.describe('订单管理 - 订单金额调整', () => {
  test('金额调整补收', async ({ page }) => {
    const { guestName } = await checkIn(page);
    await filterOrdersByKeyword(page, guestName);

    // 等待出现“已入住”的订单行
    const checkedInRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '已入住' }) })
      .first();
    await expect(checkedInRow).toBeVisible();

    // 点击该行的“查看详情”按钮
    await page.getByRole('cell', { name: '查看详情' }).getByTestId('orders-row-view').click();

    await page.getByRole('button', { name: '金额调整' }).click();

    await page.getByRole('spinbutton', { name: '调整金额 *' }).fill('50');

    await page.getByLabel('调整类型 *').click();
    await page.getByRole('option', { name: '补收' }).click();

    await page.getByLabel('支付方式 *').click();
    await page.getByRole('option', { name: '微邮付' }).click();

    await page.getByLabel('备注').fill('卖了一个簪子');

    await page.getByRole('button', { name: '保存' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '金额调整成功！'
    });
    await expect(successNotify).toBeVisible();
  });

  test('金额调整退款', async ({ page }) => {
    const { guestName } = await checkIn(page);
    await filterOrdersByKeyword(page, guestName);

    // 等待出现“已入住”的订单行
    const checkedInRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '已入住' }) })
      .first();
    await expect(checkedInRow).toBeVisible();

    // 点击该行的“查看详情”按钮
    await page.getByRole('cell', { name: '查看详情' }).getByTestId('orders-row-view').click();

    await page.getByRole('button', { name: '金额调整' }).click();

    await page.getByRole('spinbutton', { name: '调整金额 *' }).fill('30');

    await page.getByLabel('调整类型 *').click();
    await page.getByRole('option', { name: '退款' }).click();

    await page.getByLabel('支付方式 *').click();
    await page.getByRole('option', { name: '现金' }).click();

    await page.getByLabel('备注').fill('退还多收的费用');

    await page.getByRole('button', { name: '保存' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '金额调整成功！'
    });
    await expect(successNotify).toBeVisible();
  });

});

