const { test, expect } = require('@playwright/test');

const {
  checkIn,
  filterOrdersByKeyword
} = require('../tool');

test.describe('押金测试', () => {
  test('退押测试', async ({ page }) => {

    const {guestName} = await checkIn(page);

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

    // 退押金按钮
    await page.getByRole('button', { name: '退押金' }).click();

    await expect(page.getByText('account_balance_wallet 退押金')).toBeVisible();

    await page.getByRole('button', { name: '确认退押金' }).click();

    // 限定在弹窗容器内断言标题，避免与按钮文本冲突导致 strict mode 报错
    const refundDialog = page.locator('.q-dialog__inner').filter({
      has: page.locator('.q-dialog__title', { hasText: '确认退押金' })
    });
    // 仅匹配标题区域，避免与按钮同名导致 strict mode 冲突
    await expect(refundDialog.locator('.q-dialog__title', { hasText: '确认退押金' })).toBeVisible();

    // 在弹窗内点击确认退款按钮，确保操作目标唯一
    await refundDialog.getByRole('button', { name: '确认退款' }).click();

    const refundSuccessNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '退押金成功'
    });
    await expect(refundSuccessNotify).toBeVisible();

  });

});
