/**
 * 快速入住 E2E 测试
 * 测试在创建订单时选择"已入住"状态进行快速办理入住的功能
 */
const { test, expect } = require('@playwright/test');
const { fastCheckIn, fastCheckInMultiDay, fastCheckInRestRoom, filterOrdersByKeyword } = require('./tool');

test.describe.serial('快速办理入住', () => {

  /**
   * 测试用例1：快速办理单日入住
   * 入住一天，第二天退房
   */
  test('快速办理单日入住', async ({ page }) => {
    // 执行快速入住流程
    const { guestName } = await fastCheckIn(page);

    // 验证跳转到订单列表页
    await expect(page.getByText('订单列表')).toBeVisible();

    // 搜索刚创建的订单
    await filterOrdersByKeyword(page, guestName);

    // 验证订单状态为"已入住"（订单列表状态列的显示文本）
    const orderRow = page
      .locator('table tbody tr')
      .filter({ hasText: guestName })
      .first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow.locator('.q-badge', { hasText: /已入住|入住中/ })).toBeVisible();
  });

  /**
   * 测试用例2：快速办理多日入住
   * 住3晚
   */
  test('快速办理多日入住', async ({ page }) => {
    // 执行快速入住多日流程
    const { guestName } = await fastCheckInMultiDay(page);

    // 验证跳转到订单列表页
    await expect(page.getByText('订单列表')).toBeVisible();

    // 搜索刚创建的订单
    await filterOrdersByKeyword(page, guestName);

    // 验证订单状态为"已入住"
    const orderRow = page
      .locator('table tbody tr')
      .filter({ hasText: guestName })
      .first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow.locator('.q-badge', { hasText: /已入住|入住中/ })).toBeVisible();
  });

  /**
   * 测试用例3：快速办理休息房入住
   * 入住与退房同一天
   */
  test('快速办理休息房入住', async ({ page }) => {
    // 执行快速入住休息房流程
    const { guestName } = await fastCheckInRestRoom(page);

    // 验证跳转到订单列表页
    await expect(page.getByText('订单列表')).toBeVisible();

    // 搜索刚创建的订单
    await filterOrdersByKeyword(page, guestName);

    // 验证订单状态为"已入住"
    const orderRow = page
      .locator('table tbody tr')
      .filter({ hasText: guestName })
      .first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow.locator('.q-badge', { hasText: /已入住|入住中/ })).toBeVisible();
  });

});
