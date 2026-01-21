// e2e/order-manage/early_checkout.spec.js
const { test, expect } = require('@playwright/test');
// 引入创建订单/办理入住/筛选工具，复用单日流程的基础动作
const { checkIn, filterOrdersByKeyword, createMultiDayOrder, createRestOrder, checkInByKeyword, createOrder } = require('../tool');

test.describe('提前退房测试', () => {
  test('提前退房流程 - 单日', async ({ page }) => {
    // 先创建并办理入住订单，获取可筛选的客人姓名
    const { guestName } = await checkIn(page);

    // 通过搜索筛选到当前订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 点击该行的“提前退房”按钮
    await page.getByTestId('orders-row-early-checkout').click();

    // 等待提前退房弹窗显示
    await expect(page.getByText('logout 提前退房')).toBeVisible();

    // 选择“是，客人已入住”
    await page.getByRole('radio', { name: '是，客人已入住' }).check();

    await page.getByRole('button', { name: '确认提前退房' }).click();


    // 验证提前退房成功通知（兼容两种提示文案）
    const successNotify = page.locator('.q-notification').filter({
      hasText: '提前退房已完成'
    });
    await expect(successNotify).toBeVisible();
  });

  // 多日订单提前退房用例
  test('提前退房流程 - 多日', async ({ page }) => {
    // 创建多日订单，获取用于筛选的客人姓名
    const { guestName } = await createMultiDayOrder(page);

    // 办理入住，确保订单状态为“已入住”
    await checkInByKeyword(page, guestName);

    // 再次筛选到当前订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 点击该行的“提前退房”按钮
    await page.getByTestId('orders-row-early-checkout').click();

    // 等待提前退房弹窗显示
    await expect(page.getByText('logout 提前退房')).toBeVisible();

    // 选择“是，客人已入住”
    await page.getByRole('radio', { name: '是，客人已入住' }).check();

    // 提交提前退房
    await page.getByRole('button', { name: '确认提前退房' }).click();

    // 验证提前退房成功通知
    const successNotify = page.locator('.q-notification').filter({
      hasText: '提前退房已完成'
    });
    await expect(successNotify).toBeVisible();
  });

  // 休息房提前退房用例
  test('提前退房流程 - 休息', async ({ page }) => {
    // 创建休息房订单，获取用于筛选的客人姓名
    const { guestName } = await createRestOrder(page);

    // 办理入住，确保订单状态为“已入住”
    await checkInByKeyword(page, guestName);

    // 再次筛选到当前订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 点击该行的“提前退房”按钮
    await page.getByTestId('orders-row-early-checkout').click();

    // 等待提前退房弹窗显示
    await expect(page.getByText('logout 提前退房')).toBeVisible();

    // 选择“否，未入住直接退房”，避免休息房触发“不早于原退房日”的校验
    await page.getByRole('radio', { name: '否，未入住直接退房' }).check();

    // 提交提前退房
    await page.getByRole('button', { name: '确认提前退房' }).click();

    // 验证提前退房成功通知
    const successNotify = page.locator('.q-notification').filter({
      hasText: '提前退房已完成'
    });
    await expect(successNotify).toBeVisible();
  });

  // 未入住直接退房用例
  test('提前退房流程 - 未入住', async ({ page }) => {
    // 创建单日订单，获取用于筛选的客人姓名
    const { guestName } = await createOrder(page);

    // 办理入住，确保订单状态为“已入住”
    await checkInByKeyword(page, guestName);

    // 再次筛选到当前订单，避免并行冲突
    await filterOrdersByKeyword(page, guestName);

    // 点击该行的“提前退房”按钮
    await page.getByTestId('orders-row-early-checkout').click();

    // 等待提前退房弹窗显示
    await expect(page.getByText('logout 提前退房')).toBeVisible();

    // 选择“否，未入住直接退房”
    await page.getByRole('radio', { name: '否，未入住直接退房' }).check();

    // 提交提前退房
    await page.getByRole('button', { name: '确认提前退房' }).click();

    // 验证提前退房成功通知
    const successNotify = page.locator('.q-notification').filter({
      hasText: '提前退房已完成'
    });
    await expect(successNotify).toBeVisible();
  });
});
