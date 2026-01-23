const { test , expect } = require('@playwright/test');

const {
  createMultiDayOrder,
  checkInByKeyword,
  filterOrdersByKeyword
} = require('../tool');

/**
 * 打开指定客人订单的详情弹窗
 */
async function openOrderDetailsDialog(page, guestName) {
  // 通过关键字筛选订单
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

  // 确认详情弹窗已展示
  await expect(page.getByText('订单详情')).toBeVisible();
}

test.describe('每日房间安排', () => {
  test('更换其中一天的房间', async ({ page }) => {
    // 创建多日订单并办理入住
    const { guestName } = await createMultiDayOrder(page);
    await checkInByKeyword(page, guestName);

    // 打开订单详情弹窗
    await openOrderDetailsDialog(page, guestName);

    // 在“每日房间安排”里点击第一天的编辑按钮
    const detailsDialog = page.locator('.q-dialog:visible').first();
    const dailyEditButton = detailsDialog
      .locator('button:has(.q-icon:has-text("edit"))')
      .first();
    await expect(dailyEditButton).toBeVisible();
    await dailyEditButton.click();

    // 等待“更换房间”弹窗出现
    const dailyRoomDialog = page.locator('.q-dialog:visible').filter({
      hasText: '更换房间 -'
    });
    await expect(dailyRoomDialog).toBeVisible();

    // 选择一个新的房间
    await dailyRoomDialog.getByLabel('选择新房间').click();
    const unselectedOption = page.locator(
      '.q-menu:visible .q-item[aria-selected="false"]'
    );
    await expect(unselectedOption.first()).toBeVisible();
    await unselectedOption.first().click();

    // 确认更换
    await dailyRoomDialog.getByRole('button', { name: '确定' }).click();

    // 验证成功提示
    const successNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '房间更换成功'
    });
    await expect(successNotify).toBeVisible();
  });
});
