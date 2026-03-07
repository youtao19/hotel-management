const { test, expect } = require('@playwright/test');

/**
 * 进入房间状态页面并等待筛选栏加载
 */
async function openRoomStatusPage(page) {
  // 进入房间状态页面
  await page.goto('http://localhost:9011/room-status');

  // 兼容当前筛选栏文案，确认房态页筛选区已完成渲染。
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible();
}

/**
 * 在筛选栏中选择“可入住”状态并触发查询
 */
async function filterAvailableStatus(page) {
  const statusCombobox = page.locator('.room-filter-card').getByRole('combobox').nth(1);

  // 房态页筛选默认展示“全部状态”，这里直接按当前可访问名称定位。
  await statusCombobox.click();

  // 选择“可入住”
  await page.getByRole('option', { name: '可入住' }).click();

  // 触发查询，等待当前筛选条件落到列表。
  await page.getByRole('button', { name: '查询' }).click();
}

/**
 * 切换状态筛选并触发查询
 */
async function filterStatusByLabel(page, label) {
  const statusCombobox = page.locator('.room-filter-card').getByRole('combobox').nth(1);

  // 展开状态下拉框，兼容“全部状态/具体状态”展示值。
  await statusCombobox.click();

  // 选择目标状态
  await page.getByRole('option', { name: label }).click();

  // 点击查询按钮，刷新当前列表。
  await page.getByRole('button', { name: '查询' }).click();

  // 等待列表刷新
  await expect(page.locator('.room-card').first()).toBeVisible();
}

/**
 * 获取首个“空闲”房间卡片
 */
async function getFirstAvailableRoomCard(page) {
  const availableCard = page.locator('.room-card').filter({ hasText: '空闲' }).first();
  await expect(availableCard).toBeVisible();
  return availableCard;
}

/**
 * 从房间卡片中读取房号，用于后续重新定位
 */
async function getRoomNumberFromCard(card) {
  const roomNumber = (await card.locator('.room-header .text-h5').textContent())?.trim();
  expect(roomNumber).toBeTruthy();
  return roomNumber;
}

/**
 * 点击指定房间卡片内的操作按钮（带简单重试，避免渲染导致元素重建）
 */
async function clickRoomAction(page, roomNumber, actionLabel) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const card = page.locator('.room-card', {
        has: page.locator('.room-header .text-h5', { hasText: roomNumber })
      }).first();
      await expect(card).toBeVisible();
      const actionButton = card.getByRole('button', { name: actionLabel });
      await expect(actionButton).toBeVisible();
      await actionButton.click();
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(300);
    }
  }
  throw lastError;
}

test.describe('房间管理 - 房间状态', () => {
  test('筛选可入住房间', async ({ page }) => {
    // 进入页面并筛选可入住
    await openRoomStatusPage(page);
    await filterAvailableStatus(page);

    // 校验筛选结果至少展示一个房间
    await expect(page.locator('.room-card').first()).toBeVisible();
  });

  test('将空闲房间设置为清理并完成清洁', async ({ page }) => {
    // 进入页面并筛选可入住
    await openRoomStatusPage(page);
    await filterAvailableStatus(page);

    // 选择一个空闲房间卡片
    const availableCard = await getFirstAvailableRoomCard(page);
    const roomNumber = await getRoomNumberFromCard(availableCard);

    // 点击“清理”按钮
    await availableCard.getByRole('button', { name: '清理' }).click();

    // 验证设置清洁成功提示
    const cleaningNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '已设为清扫状态'
    });
    await expect(cleaningNotify).toBeVisible();

    // 切换筛选到“清扫中”，避免可入住筛选导致房间不可见
    await filterStatusByLabel(page, '清扫中');

    // 重新定位该房间卡片并完成清洁
    const cleaningCard = page.locator('.room-card', {
      has: page.locator('.room-header .text-h5', { hasText: roomNumber })
    }).first();
    await expect(cleaningCard).toBeVisible();
    await expect(cleaningCard).toContainText('清扫中');
    await clickRoomAction(page, roomNumber, '完成清洁');

    // 验证清洁完成提示
    const cleaningDoneNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '清洁已完成'
    });
    await expect(cleaningDoneNotify).toBeVisible();
  });

  test('将可入住房间设置为维修并完成维修', async ({ page }) => {
    // 进入页面并筛选可入住
    await openRoomStatusPage(page);
    await filterAvailableStatus(page);

    // 选择一个空闲房间卡片
    const availableCard = await getFirstAvailableRoomCard(page);
    const roomNumber = await getRoomNumberFromCard(availableCard);

    // 点击“维修”按钮
    await availableCard.getByRole('button', { name: '维修' }).click();

    // 验证设置维修成功提示
    const maintenanceNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '已设为维修状态'
    });
    await expect(maintenanceNotify).toBeVisible();

    // 切换筛选到“维修中”，避免可入住筛选导致房间不可见
    await filterStatusByLabel(page, '维修中');

    // 重新定位该房间卡片并完成维修
    const maintenanceCard = page.locator('.room-card', {
      has: page.locator('.room-header .text-h5', { hasText: roomNumber })
    }).first();
    await expect(maintenanceCard).toBeVisible();
    await expect(maintenanceCard).toContainText('维修中');
    await clickRoomAction(page, roomNumber, '完成维修');

    // 验证维修完成提示
    const maintenanceDoneNotify = page.locator('.q-notification.bg-positive').filter({
      hasText: '维修已完成'
    });
    await expect(maintenanceDoneNotify).toBeVisible();
  });
});
