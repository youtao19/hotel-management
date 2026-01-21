// e2e/order-manage/extend_stay.spec.js
const { test, expect } = require('@playwright/test');
// 复用创建订单与筛选工具，确保用例与其他测试一致
const { checkIn, filterOrdersByKeyword } = require('../tool');

test.describe('续住测试', () => {
  test('续住流程', async ({ page }) => {
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

    // 点击该行的“续住”按钮
    await checkedInRow.getByTestId('orders-row-extend-stay').click();

    // 等待续住弹窗显示
    await expect(page.getByText('续住办理')).toBeVisible();

    // 优先继续住原房间；若不可用则手动选择首个可用房间
    const keepRoomButton = page.getByRole('button', { name: '继续住原房间' });
    if (await keepRoomButton.isVisible()) {
      await keepRoomButton.click();
    } else {
      // 手动选择房间：打开下拉并点击首个选项
      await page.getByRole('combobox', { name: '选择房间' }).click();
      const roomMenu = page.locator('.q-menu:visible').first();
      await expect(roomMenu).toBeVisible();
      await roomMenu.locator('.q-item').first().click();
    }

    // 提交续住
    await page.getByRole('button', { name: '确认续住' }).click();

    // 验证续住成功通知
    const successNotify = page.locator('.q-notification').filter({
      hasText: '续住订单创建成功'
    });
    await expect(successNotify).toBeVisible();
  });

  // 已退房订单续住用例
  test('退房后续住流程', async ({ page }) => {
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

    // 确认退房弹窗并完成退房
    await expect(page.getByText('确认退房')).toBeVisible();
    await page.getByRole('button', { name: '确定' }).click();

    // 验证退房成功通知
    const checkoutNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '退房成功'
    });
    await expect(checkoutNotify).toBeVisible();

    // 重新筛选订单，等待状态更新为“已退房”
    await filterOrdersByKeyword(page, guestName);
    const checkedOutRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('.q-badge', { hasText: '已退房' }) })
      .first();
    await expect(checkedOutRow).toBeVisible();

    // 点击该行的“续住”按钮
    await checkedOutRow.getByTestId('orders-row-extend-stay').click();

    // 等待续住弹窗显示
    await expect(page.getByText('续住办理')).toBeVisible();

    // 优先继续住原房间；若不可用则手动选择首个可用房间
    const keepRoomButton = page.getByRole('button', { name: '继续住原房间' });
    if (await keepRoomButton.isVisible()) {
      await keepRoomButton.click();
    } else {
      // 手动选择房间：打开下拉并点击首个选项
      await page.getByRole('combobox', { name: '选择房间' }).click();
      const roomMenu = page.locator('.q-menu:visible').first();
      await expect(roomMenu).toBeVisible();
      await roomMenu.locator('.q-item').first().click();
    }

    // 提交续住
    await page.getByRole('button', { name: '确认续住' }).click();

    // 验证续住成功通知
    const successNotify = page.locator('.q-notification').filter({
      hasText: '续住订单创建成功'
    });
    await expect(successNotify).toBeVisible();
  });
});
