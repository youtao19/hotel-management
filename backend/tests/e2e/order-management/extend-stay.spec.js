// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 订单管理（ViewOrders）- 续住
 *
 * 覆盖：
 * - 已入住/已退房允许续住（本用例以"已退房"路径为主）
 * - 续住后新订单可搜索，离店日期可见（确保日期更新展示）
 */

// ============================================================================
// 配置常量
// ============================================================================

const e2eCredentials = {
  email: process.env.E2E_EMAIL || 'wuyoutao19@qq.com',
  password: process.env.E2E_PASSWORD || 'wyt.1219'
};
const e2eBaseURL = process.env.FRONTEND_URL || 'http://localhost:9000';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取一个"全局互斥锁"
 * @param {string} lockKey
 * @param {{ timeoutMs?: number, pollMs?: number, staleMs?: number }} [opts]
 * @returns {Promise<() => Promise<void>>}
 */
async function acquireE2ELock(lockKey = 'order-management', opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const pollMs = opts.pollMs ?? 250;
  const staleMs = opts.staleMs ?? 10 * 60_000;
  const lockDir = path.join(process.cwd(), 'backend', 'test-results');
  const lockPath = path.join(lockDir, `.e2e-lock-${lockKey}.lock`);

  await fs.mkdir(lockDir, { recursive: true });

  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const fh = await fs.open(lockPath, 'wx');
      await fh.writeFile(JSON.stringify({ lockKey, pid: process.pid, createdAt: new Date().toLocaleString('zh-CN') }));
      await fh.close();
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.unlink(lockPath);
          continue;
        }
      } catch (statErr) {
        // ignore
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`获取 E2E 锁超时: ${lockPath}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  }
}

/**
 * 统一把日期格式化成 YYYY-MM-DD
 * @param {Date} d
 */
function formatLocalYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 仅做"自然日"加减
 * @param {Date} date
 * @param {number} days
 */
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * 生成指定长度的随机数字串
 * @param {number} length
 */
function randomDigits(length) {
  let s = '';
  for (let i = 0; i < length; i += 1) s += String(Math.floor(Math.random() * 10));
  return s;
}

/**
 * 登录
 * @param {import('@playwright/test').Page} page
 */
async function login(page) {
  const { email, password } = e2eCredentials;
  if (!email || !password) {
    throw new Error('缺少 E2E_EMAIL / E2E_PASSWORD');
  }
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/Dash-board', { timeout: 30_000 });
}

/**
 * 选择房型+房号
 * @param {import('@playwright/test').Page} page
 */
async function selectRoomTypeAndNumber(page) {
  const roomTypeCombobox = page.getByRole('combobox', { name: '房间类型' });
  const roomNumberCombobox = page.getByRole('combobox', { name: '房间号' });

  // 第一次点击打开菜单并获取选项数量
  await roomTypeCombobox.click();
  // 等待菜单渲染
  await expect(page.locator('.q-menu:visible')).toBeVisible({ timeout: 30_000 });
  const optionCount = await page.locator('.q-menu:visible .q-item').filter({ hasNotText: '所有房型' }).count();
  // 关闭菜单，以便后面循环中重新打开
  await page.keyboard.press('Escape');
  await expect(page.locator('.q-menu:visible')).toHaveCount(0, { timeout: 5_000 });

  for (let i = 0; i < optionCount; i += 1) {
    // 每轮重新打开房型下拉
    await roomTypeCombobox.click();
    await expect(page.locator('.q-menu:visible')).toBeVisible({ timeout: 30_000 });
    const option = page.locator('.q-menu:visible .q-item').filter({ hasNotText: '所有房型' }).nth(i);
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
    // 等待房型菜单关闭后再打开房号菜单
    await expect(page.locator('.q-menu:visible')).toHaveCount(0, { timeout: 5_000 });

    await roomNumberCombobox.click();
    await expect(page.locator('.q-menu:visible')).toBeVisible({ timeout: 30_000 });
    const roomNumberOption = page
      .locator('.q-menu:visible .q-item')
      .filter({ hasNotText: /没有可用|请选择/ })
      .filter({ hasText: /^\s*\d+/ })  // 匹配以数字开头的房号，如 "116" 或 "116 (醉山塘)"
      .first();

    if (await roomNumberOption.count()) {
      await roomNumberOption.click();
      return;
    }
    // 关闭房号下拉菜单
    await page.keyboard.press('Escape');
    await expect(page.locator('.q-menu:visible')).toHaveCount(0, { timeout: 5_000 });
  }
  throw new Error('未找到可用房型/房号（请检查该日期范围是否有可用房间）');
}

/**
 * 填写每日价格
 * @param {import('@playwright/test').Page} page
 * @param {{ stayDates: string[], isRestRoom: boolean }} params
 */
async function fillDailyPrices(page, { stayDates, isRestRoom }) {
  for (const d of stayDates) {
    const label = stayDates.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : d;
    await page.getByRole('spinbutton', { name: label }).fill('100');
  }
}

/**
 * 创建订单
 * @param {import('@playwright/test').Page} page
 * @param {{ orderId: string, guestName: string, phone: string, checkInDate: string, checkOutDate: string, stayDates: string[] }} params
 */
async function createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates }) {
  await page.goto('/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('textbox', { name: '订单号' }).fill(orderId);
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phone);
  await page.getByRole('textbox', { name: '入住日期' }).fill(checkInDate);
  await page.getByRole('textbox', { name: '离店日期' }).fill(checkOutDate);

  await selectRoomTypeAndNumber(page);
  await fillDailyPrices(page, { stayDates, isRestRoom: checkInDate === checkOutDate });

  await page.getByRole('button', { name: '确认创建' }).click();
  await page.waitForURL('**/ViewOrders', { timeout: 30_000 });
}

/**
 * 重置筛选条件
 * @param {import('@playwright/test').Page} page
 */
async function resetOrderFilters(page) {
  await expect(page).toHaveURL(/\/ViewOrders/);
  await page.getByRole('button', { name: '清除' }).click();
  await expect(page.getByRole('textbox', { name: '搜索订单' })).toHaveValue('');
}

/**
 * 按客人姓名搜索订单
 * @param {import('@playwright/test').Page} page
 * @param {string} guestName
 */
async function searchOrderByGuestName(page, guestName) {
  await expect(page).toHaveURL(/\/ViewOrders/);
  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName);
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
}

/**
 * 按关键字搜索唯一订单
 * @param {import('@playwright/test').Page} page
 * @param {string} query
 */
async function searchOrderByQuery(page, query) {
  await expect(page).toHaveURL(/\/ViewOrders/);
  await page.getByRole('textbox', { name: '搜索订单' }).fill(query);
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
}

/**
 * 打开订单详情弹窗
 * @param {import('@playwright/test').Page} page
 */
async function openOrderDetailsFromFirstRow(page) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByTestId('orders-row-view').click();
  await expect(page.getByText('订单详情')).toBeVisible({ timeout: 30_000 });
}

/**
 * 从订单详情办理入住
 * @param {import('@playwright/test').Page} page
 * @param {{ deposit?: string }} [params]
 */
async function checkInFromDetails(page, params = {}) {
  const deposit = params.deposit ?? '200';

  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
  await expect(orderDetailsDialog).toBeVisible({ timeout: 30_000 });
  await orderDetailsDialog.getByRole('button', { name: '办理入住' }).click();

  const checkInConfirmDialog = page.getByRole('dialog').filter({ hasText: '确认办理入住' });
  await expect(checkInConfirmDialog).toBeVisible({ timeout: 30_000 });

  const depositInput = checkInConfirmDialog
    .locator('[data-testid="checkin-deposit"] input, input[aria-label="押金"], input[type="number"]')
    .first();
  await expect(depositInput).toBeVisible({ timeout: 30_000 });
  await depositInput.fill(String(deposit));

  await expect(checkInConfirmDialog.getByRole('button', { name: '确认办理入住' })).toBeVisible({ timeout: 30_000 });
  await checkInConfirmDialog.getByRole('button', { name: '确认办理入住' }).click();
  await expect(page.getByText('入住成功')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * 从订单详情办理退房
 * @param {import('@playwright/test').Page} page
 */
async function checkOutFromDetails(page) {
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
  await expect(orderDetailsDialog).toBeVisible({ timeout: 30_000 });
  await orderDetailsDialog.getByRole('button', { name: '办理退房' }).click();
  const checkOutConfirmDialog = page.getByRole('dialog').filter({ hasText: '确认退房' });
  await expect(checkOutConfirmDialog).toBeVisible({ timeout: 30_000 });
  await checkOutConfirmDialog.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('退房成功')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * 从订单列表行触发续住
 * @param {import('@playwright/test').Page} page
 * @param {{ extendStartDate: string, extendEndDate: string, unitPrice: number }} params
 * @returns {Promise<string>} 新订单号
 */
async function extendStayFromFirstRow(page, { extendStartDate, extendEndDate, unitPrice }) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByTestId('orders-row-extend-stay').click();

  const extendStayDialog = page.getByRole('dialog').filter({ hasText: '续住办理' });
  await expect(extendStayDialog).toBeVisible({ timeout: 30_000 });

  // 选择房间：优先点击"继续住原房间"
  const useOriginalRoomBtn = extendStayDialog.getByRole('button', { name: '继续住原房间' });
  if (await useOriginalRoomBtn.isVisible()) {
    await useOriginalRoomBtn.click();
  } else {
    await extendStayDialog.getByRole('combobox', { name: '选择房间' }).click();
    const firstRoomOption = page.locator('.q-menu .q-item').first();
    await expect(firstRoomOption).toBeVisible({ timeout: 30_000 });
    await firstRoomOption.click();
  }

  // 设置续住日期
  await extendStayDialog.getByRole('textbox', { name: '入住日期' }).fill(extendStartDate);
  await extendStayDialog.getByRole('textbox', { name: '离店日期' }).fill(extendEndDate);

  // 单日续住：填写单价
  await extendStayDialog.getByRole('spinbutton', { name: '续住单价' }).fill(String(unitPrice));
  const totalPriceText = extendStayDialog.locator('.text-h6').filter({ hasText: '¥' }).first();
  await expect(totalPriceText).toBeVisible({ timeout: 30_000 });
  await expect(totalPriceText).toHaveText(/¥\s*[1-9]/, { timeout: 30_000 });

  // 读取自动生成的新订单号
  const newOrderInput = extendStayDialog.getByRole('textbox', { name: '订单号' });
  const newOrderNumber = (await newOrderInput.inputValue()).trim();
  if (!newOrderNumber) {
    const fallback = `E2E-EXT-${Date.now()}`;
    await newOrderInput.fill(fallback);
    await extendStayDialog.getByRole('button', { name: '确认续住' }).click();
    await expect(page.getByText('续住订单创建成功')).toBeVisible({ timeout: 30_000 });
    return fallback;
  }

  await extendStayDialog.getByRole('button', { name: '确认续住' }).click();
  await expect(page.getByText('续住订单创建成功')).toBeVisible({ timeout: 30_000 });
  return newOrderNumber;
}

// ============================================================================
// 测试用例
// ============================================================================

test.describe('订单管理（ViewOrders）- 续住', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').BrowserContext | null} */
  let context = null;
  /** @type {import('@playwright/test').Page | null} */
  let page = null;
  /** @type {null | (() => Promise<void>)} */
  let releaseLock = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(240_000);
    releaseLock = await acquireE2ELock('order-management');
    context = await browser.newContext({ baseURL: e2eBaseURL });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await context?.close();
    await releaseLock?.();
    context = null;
    page = null;
  });

  test('续住：已退房允许续住；续住后离店日期/费用更新可见', async () => {
    if (!page) throw new Error('page not initialized');

    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const checkOutDate = formatLocalYMD(addDays(today, 1));
    const stayDates = [checkInDate];
    const extendStartDate = checkOutDate;
    const extendEndDate = formatLocalYMD(addDays(today, 2));

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-OM-续住-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);

    // 先办理入住 -> 再办理退房，让订单进入 checked-out
    await openOrderDetailsFromFirstRow(page);
    await checkInFromDetails(page, { deposit: '200' });
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);
    await openOrderDetailsFromFirstRow(page);
    await checkOutFromDetails(page);
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);
    await expect(page.locator('tbody tr').first()).toContainText('已退房');

    const newOrderNumber = await extendStayFromFirstRow(page, { extendStartDate, extendEndDate, unitPrice: 100 });

    // 按新订单号搜索，断言新订单存在且离店日期为选择的 extendEndDate
    await page.goto('/ViewOrders');
    await resetOrderFilters(page);
    await searchOrderByQuery(page, newOrderNumber);
    const newRow = page.locator('tbody tr').first();
    await expect(newRow).toContainText(newOrderNumber);
    await expect(newRow).toContainText(extendEndDate);
  });
});
