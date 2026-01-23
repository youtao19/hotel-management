const { test, expect } = require('@playwright/test');

const {
  checkIn,
  createMultiDayOrder,
  checkInByKeyword,
  filterOrdersByKeyword
} = require('../tool');

/**
 * 打开指定客人订单的“修改订单”对话框
 */
async function openChangeOrderDialog(page, guestName) {
  await filterOrdersByKeyword(page, guestName);

  // 等待出现“已入住”的订单行
  const checkedInRow = page
    .locator('table tbody tr')
    .filter({ has: page.locator('.q-badge', { hasText: '已入住' }) })
    .first();
  await expect(checkedInRow).toBeVisible();

  // 点击该行的“查看详情”按钮
  await checkedInRow
    .getByRole('cell', { name: '查看详情' })
    .getByTestId('orders-row-view')
    .click();

  // 打开“修改订单”对话框
  await page.getByRole('button', { name: '修改订单' }).click();

  // 确认对话框已展示
  await expect(page.getByText('修改订单信息')).toBeVisible();
}

test.describe('订单管理 - 订单变更', () => {
  test('修改房间', async ({ page }) => {
    const { guestName } = await checkIn(page);
    await openChangeOrderDialog(page, guestName);

    // 点击「房间号」q-select，展开下拉框
    await page.getByLabel('房间号').click();

    // 等待下拉菜单出现（Quasar 的 q-menu）
    const options = page.locator('.q-menu .q-item');

    // 等待至少有一个选项
    await expect(options.first()).toBeVisible();

    // 选择一个未被选中的房间（避免读取输入框导致等待超时）
    const unselectedOption = page.locator(
      '.q-menu .q-item[aria-selected="false"]'
    );
    await expect(unselectedOption.first()).toBeVisible();
    await unselectedOption.first().click();

    // 点击保存按钮
    await page.getByRole('button', { name: '保存更改' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单更新成功'
    });
    await expect(successNotify).toBeVisible();

  });

  test('修改单日房费', async ({ page }) => {
    const { guestName } = await checkIn(page);
    await openChangeOrderDialog(page, guestName);

    // 定位房费表格中的单日金额输入框并修改
    const roomFeeTable = page.locator('.q-markup-table');
    const roomFeeInputs = roomFeeTable.locator('input[type="number"]');
    await expect(roomFeeInputs).toHaveCount(1);
    await roomFeeInputs.first().fill('300');

    // 点击保存按钮
    await page.getByRole('button', { name: '保存更改' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单更新成功'
    });
    await expect(successNotify).toBeVisible();
  });

  test('修改多日房费', async ({ page }) => {
    // 创建多日订单并办理入住
    const { guestName } = await createMultiDayOrder(page);
    await checkInByKeyword(page, guestName);
    await openChangeOrderDialog(page, guestName);

    // 定位房费表格中的多日金额输入框并分别修改
    const roomFeeTable = page.locator('.q-markup-table');
    const roomFeeInputs = roomFeeTable.locator('input[type="number"]');
    await expect(roomFeeInputs.first()).toBeVisible();
    await roomFeeInputs.nth(0).fill('280');
    await roomFeeInputs.nth(1).fill('260');

    // 点击保存按钮
    await page.getByRole('button', { name: '保存更改' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单更新成功'
    });
    await expect(successNotify).toBeVisible();
  });

  test('修改支付方式', async ({ page }) => {
    const { guestName } = await checkIn(page);
    await openChangeOrderDialog(page, guestName);

    // 展开支付方式下拉并选择未选中的方式
    await page.getByLabel('支付方式').click();
    const unselectedPay = page.locator(
      '.q-menu:visible .q-item[aria-selected="false"]'
    );
    await expect(unselectedPay.first()).toBeVisible();
    await unselectedPay.first().click();

    // 点击保存按钮
    await page.getByRole('button', { name: '保存更改' }).click();

    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '订单更新成功'
    });
    await expect(successNotify).toBeVisible();
  }); 
});
