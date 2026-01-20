// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 订单管理（ViewOrders）- 取消订单
 *
 * 覆盖：
 * - pending / checked-in 可取消
 * - 取消后状态变更且不可再办理入住/退房（按钮显隐）
 */

// ============================================================================
// 配置常量
// ============================================================================

// 说明：默认值仅用于本地开发，CI/真实环境请通过环境变量覆盖
const e2eCredentials = {
  email: process.env.E2E_EMAIL || 'wuyoutao19@qq.com',
  password: process.env.E2E_PASSWORD || 'wyt.1219'
};
const e2eBaseURL = process.env.FRONTEND_URL || 'http://localhost:9000';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取一个"全局互斥锁"：用于在 Playwright 多 worker 并行时，避免多条订单用例同时抢房导致不稳定。
 * @param {string} lockKey - 锁名（同名会互斥）
 * @param {{ timeoutMs?: number, pollMs?: number, staleMs?: number }} [opts]
 * @returns {Promise<() => Promise<void>>} - 释放锁函数
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
          // 释放锁失败时忽略
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
 * 统一把日期格式化成 YYYY-MM-DD（与表单/后端 DATE 口径一致）
 * @param {Date} d
 */
function formatLocalYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 仅做"自然日"加减，避免涉及时区/UTC 转换
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
 * 登录：进入 /login 填写账号密码并确保跳转到仪表盘
 * @param {import('@playwright/test').Page} page
 */
async function login(page) {
  const { email, password } = e2eCredentials;
  if (!email || !password) {
    throw new Error('缺少 E2E_EMAIL / E2E_PASSWORD，无法执行订单管理 E2E');
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
 * 确认 Quasar $q.dialog
 * @param {import('@playwright/test').Page} page
 * @param {string} titleText
 * @param {string} [okName]
 */
async function confirmQuasarDialog(page, titleText, okName = '确定') {
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: titleText })
    .filter({ has: page.getByRole('button', { name: okName }) });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: okName }).click();
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * 从订单列表行触发取消订单
 * @param {import('@playwright/test').Page} page
 */
async function cancelOrderFromFirstRow(page) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByTestId('orders-row-cancel').click();
  await confirmQuasarDialog(page, '确认取消', '确定');
  await expect(page.getByText('订单已取消')).toBeVisible({ timeout: 30_000 });
}

// ============================================================================
// 测试用例
// ============================================================================

test.describe('订单管理（ViewOrders）- 取消订单', () => {
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

  test('取消订单：pending 可取消；取消后不可再办理入住/退房', async () => {
    if (!page) throw new Error('page not initialized');

    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const checkOutDate = formatLocalYMD(addDays(today, 1));
    const stayDates = [checkInDate];

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-OM-取消P-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);

    await cancelOrderFromFirstRow(page);

    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('已取消');
    // 取消后操作按钮应消失：不可再入住/退房
    await expect(row.getByTestId('orders-row-check-in')).toHaveCount(0);
    await expect(row.getByTestId('orders-row-checkout')).toHaveCount(0);

    // 详情弹窗里也不应出现办理入住/退房按钮
    await openOrderDetailsFromFirstRow(page);
    const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
    await expect(orderDetailsDialog.getByRole('button', { name: '办理入住' })).toHaveCount(0);
    await expect(orderDetailsDialog.getByRole('button', { name: '办理退房' })).toHaveCount(0);
  });

  test('取消订单：checked-in 可取消；取消后不可再退房/提前退房', async () => {
    if (!page) throw new Error('page not initialized');

    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const checkOutDate = formatLocalYMD(addDays(today, 1));
    const stayDates = [checkInDate];

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-OM-取消CI-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);

    // 先办理入住，得到 checked-in 状态
    await openOrderDetailsFromFirstRow(page);
    await checkInFromDetails(page, { deposit: '200' });
    await resetOrderFilters(page);
    await searchOrderByGuestName(page, guestName);
    await expect(page.locator('tbody tr').first()).toContainText('已入住');

    // checked-in 状态可取消
    await cancelOrderFromFirstRow(page);
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('已取消');
    // 取消后不可再退房/提前退房
    await expect(row.getByTestId('orders-row-checkout')).toHaveCount(0);
    await expect(row.getByTestId('orders-row-early-checkout')).toHaveCount(0);
  });
});
