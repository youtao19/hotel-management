// e2e/order-manage/create.spec.js
const { test, expect } = require('@playwright/test');

const {
  createOrder,
  createMultiDayOrder,
  createRestOrder
} = require('../tool');

/**
 * 选择有剩余房间的房型，避免选到 0 间
 */
async function selectAvailableRoomType(page) {
  // 打开房型下拉框
  await page.getByRole('combobox', { name: '房间类型' }).click();
  // 仅选取当前可见的下拉菜单，避免多个菜单干扰
  const menu = page.locator('.q-menu:visible').first();
  // 确认下拉菜单已显示
  await expect(menu).toBeVisible();
  // 获取所有房型选项
  const roomOptions = menu.locator('.q-item');
  // 记录有剩余房间的选项索引
  const availableIndexes = [];
  // 统计选项数量
  const count = await roomOptions.count();
  // 遍历选项并筛选剩余房间不为 0 的房型
  for (let i = 0; i < count; i += 1) {
    // 读取房型剩余数量徽标
    const badgeText = (await roomOptions.nth(i).locator('.q-badge').textContent()) || '';
    // 仅保留非 0 间的房型
    if (badgeText.includes('间') && !badgeText.includes('0间')) {
      availableIndexes.push(i);
    }
  }
  // 若存在可用房型则优先选择，否则选第一个兜底
  const targetIndex = availableIndexes.length > 0 ? availableIndexes[0] : 0;
  // 点击选中的房型
  await roomOptions.nth(targetIndex).click();
}

/**
 * 选择一个可用房间号
 */
async function selectAnyRoomNumber(page) {
  // 打开房间号下拉框
  const roomNumberSelect = page.getByRole('combobox', { name: '房间号' });
  // 确保房间号下拉可用
  await expect(roomNumberSelect).toBeEnabled();
  // 点击展开房间号列表
  await roomNumberSelect.click();
  // 仅选取当前可见的下拉菜单，避免多个菜单干扰
  const menu = page.locator('.q-menu:visible').first();
  // 确认下拉菜单已显示
  await expect(menu).toBeVisible();
  // 获取可选房间号列表
  const roomOptions = menu.locator('.q-item');
  // 确保存在可选房间号
  await expect(roomOptions.first()).toBeVisible();
  // 选择第一个可用房间号
  await roomOptions.first().click();
}

test.describe('订单创建测试', () => {

  test('单日订单', async ({ page }) => {
    // 此时浏览器已经带有登录成功的 Cookies
    await page.goto('http://localhost:9011/Dash-board');
    await createOrder(page);
  });

  test('多日订单', async ({ page }) => {
    await createMultiDayOrder(page);
  });

  test('休息房订单', async ({ page }) => {
    await createRestOrder(page);
  });

  test('立即入住订单支付方式为字符串', async ({ page }) => {
    // 进入创建订单页面
    await page.goto('http://localhost:9011/CreateOrder');
    // 确认页面标题已展示
    await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();
    // 生成唯一的客人姓名，避免并发冲突
    const guestName = `立即入住测试_${Date.now().toString().slice(-4)}`;
    // 生成唯一手机号（11 位）
    const phoneNumber = `138${Date.now().toString().slice(-8)}`;
    // 填写客人姓名
    await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
    // 填写手机号
    await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phoneNumber);
    // 选择订单状态为“已入住”（触发立即入住流程）
    await page.getByLabel('订单状态').click();
    // 从下拉中选择“已入住”
    await page.locator('.q-menu:visible .q-item').filter({ hasText: '已入住' }).first().click();
    // 选择房型
    await selectAvailableRoomType(page);
    // 选择房间号
    await selectAnyRoomNumber(page);
    // 打开支付方式下拉框
    await page.getByLabel('支付方式').click();
    // 选择“现金”作为支付方式
    await page.locator('.q-menu:visible .q-item').filter({ hasText: '现金' }).first().click();
    // 提交创建订单
    await page.getByRole('button', { name: '确认创建' }).click();
    // 定位“确认立即入住”对话框容器，避免点击到页面底部的“确认创建”
    const checkInDialog = page.locator('.q-dialog:visible').filter({ hasText: '确认立即入住' });
    // 确认对话框已出现
    await expect(checkInDialog).toBeVisible();
    // 在对话框中点击“确定”
    await checkInDialog.getByRole('button', { name: '确定' }).click();
    // 获取立即入住确认弹窗中的“支付方式”输入框
    const paymentInput = page.locator('.fee-card').filter({ hasText: '支付方式' }).locator('input');
    // 确认支付方式输入框可见
    await expect(paymentInput).toBeVisible();
    // 读取支付方式显示值
    const paymentValue = await paymentInput.inputValue();
    // 断言支付方式为字符串且为已选择的中文文本
    expect(paymentValue).toBe('现金');
  });

});
