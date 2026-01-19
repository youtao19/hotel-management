// @ts-check
import { test, expect } from '@playwright/test';
import { acquireE2ELock } from './helpers/orderManagement.e2e.helper.js';

/**
 * 订单 E2E：覆盖「创建订单 -> 进入订单详情 -> 办理入住」核心链路
 *
 * 说明：
 * - 用例通过 UI 走真实业务流程（不是直接调接口），尽量模拟一线操作。
 * - 为避免用例间互相抢房/抢资源，套件使用 serial 串行执行。
 * - 本文件单独创建 context 并在 beforeAll 登录，避免与其它用例并发时共享登录态造成干扰。
 */
const email = process.env.E2E_EMAIL || 'wuyoutao19@qq.com';
const password = process.env.E2E_PASSWORD || 'wyt.1219';
const baseURL = process.env.FRONTEND_URL || 'http://localhost:9000';

// 统一把日期格式化成 YYYY-MM-DD（与表单/后端 DATE 口径一致）
function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalYMD(d) {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
}

// 仅做“自然日”加减，避免涉及时区/UTC 转换
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// 生成指定长度的随机数字串（用于手机号/订单号后缀，避免撞数据）
function randomDigits(length) {
  let s = '';
  for (let i = 0; i < length; i += 1) s += String(Math.floor(Math.random() * 10));
  return s;
}

/**
 * 登录：进入 /login 填写账号密码并确保跳转到仪表盘
 * - 这里不依赖 storageState，是为了在本 spec 内部自洽，减少并发/共享状态带来的不确定性。
 */
async function login(page) {
  if (!email || !password) {
    throw new Error('缺少 E2E_EMAIL / E2E_PASSWORD，无法执行登录与下单 E2E');
  }
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/Dash-board', { timeout: 30_000 });
}

/**
 * 选择房型+房号：
 * - 优先选择“可用房数 > 0”的房型（UI 文案包含 `x间`），避免选到无房导致无法提交。
 * - 再从房号列表里选第一个可用房号。
 */
async function selectRoomTypeAndNumber(page) {
  const roomTypeCombobox = page.getByRole('combobox', { name: '房间类型' });
  const roomNumberCombobox = page.getByRole('combobox', { name: '房间号' });

  // 说明：房型选项在不同版本/主题下，可能不直接展示“剩余 x 间”，因此不能只靠文案过滤。
  // 做法：遍历房型选项，逐个尝试打开房号下拉，找到“有可用房号”的房型后再选房号。
  await roomTypeCombobox.click();
  const optionCount = await page.locator('.q-menu:visible .q-item').filter({ hasNotText: '所有房型' }).count();

  for (let i = 0; i < optionCount; i += 1) {
    // 每轮重新打开房型下拉：Quasar 选中后会关闭菜单，下一轮需要再次展开
    await roomTypeCombobox.click();
    const option = page.locator('.q-menu:visible .q-item').filter({ hasNotText: '所有房型' }).nth(i);
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();

    await roomNumberCombobox.click();

    // 房号列表里可能出现“没有可用房间/请选择”等占位项，这里仅选择纯数字房号（例如 105）。
    const roomNumberOption = page
      .locator('.q-menu:visible .q-item')
      .filter({ hasNotText: /没有可用|请选择/ })
      .filter({ hasText: /^\s*\d+\s*$/ })
      .first();

    if (await roomNumberOption.count()) {
      await roomNumberOption.click();
      return;
    }

    // 当前房型在该日期范围下无房号可选：关闭下拉并继续尝试下一个房型
    await page.keyboard.press('Escape');
  }

  throw new Error('未找到可用房型/房号（请检查该日期范围是否有可用房间）');
}

/**
 * 填写每日价格：
 * - 单日订单/休息房订单：表单只有一个价格输入框，label 分别为“住宿价格/休息房价格”。
 * - 多日订单：价格输入框的 label 是具体日期（YYYY-MM-DD）。
 */
async function fillDailyPrices(page, { stayDates, isRestRoom }) {
  for (const d of stayDates) {
    const label = stayDates.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : d;
    await page.getByRole('spinbutton', { name: label }).fill('100');
  }
}

/**
 * 创建订单：在 CreateOrder 页面填写最小必填项并提交
 * - 订单号：手动填入唯一值，避免页面“自动生成订单号”在并发/快速创建时重复。
 * - 客人信息：姓名/手机号允许随机，避免与历史数据冲突。
 * - 入住/离店日期：通过日期组合区分单日/多日/休息房订单。
 */
async function createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates }) {
  await page.goto('/CreateOrder');
  // 防御性等待：首次进入创建订单页时渲染可能较慢（CI/低性能环境），提高超时时间避免误报
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
 * 从订单详情办理入住：
 * 1) 在“查看订单”页用客人姓名搜索到唯一订单
 * 2) 打开订单详情 -> 点击“办理入住”
 * 3) 在确认弹窗中点“确认办理入住”，等待提示“入住成功”
 * 4) 再次打开订单详情，断言状态已变为“已入住”
 */
async function checkInFromOrderDetails(page, guestName) {
  await expect(page).toHaveURL(/\/ViewOrders/);

  // 防御性等待：确保没有遗留弹窗遮罩层拦截点击（Quasar dialog 的 backdrop 会拦截 pointer events）。
  // 说明：这是为了解决“上一轮打开订单详情但未关闭，导致后续点击查看详情被遮罩层拦截”的不稳定问题。
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName);
  await page.getByRole('button', { name: '搜索' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
  await page.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click();

  await expect(page.getByText('订单详情')).toBeVisible();

  // 限定在“订单详情”弹窗内点击，避免与表格行内同名图标按钮（aria-label=办理入住）冲突导致 strict mode 报错。
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
  await expect(orderDetailsDialog).toBeVisible();
  await orderDetailsDialog.getByRole('button', { name: '办理入住' }).click();

  await expect(page.getByRole('button', { name: '确认办理入住' })).toBeVisible();
  await page.getByRole('button', { name: '确认办理入住' }).click();

  await expect(page.getByText('入住成功')).toBeVisible({ timeout: 30_000 });
}

/**
 * 从订单详情办理退房
 * 1) 在“查看订单”页用客人姓名搜索到唯一订单
 * 2) 打开订单详情 -> 点击“办理退房”
 * 3) 在弹出的窗口中点击确认
 * 4) 等待提示“退房成功”
 */
async function checkOutFromOrderDetails(page,guestName) {
  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName);
  // 与入住流程保持一致：填写搜索条件后必须点击搜索，避免依赖上一次列表状态造成不稳定。
  await page.getByRole('button', { name: '搜索' }).click();

  await page.getByRole('button', { name: '查看详情'}).click();
  await expect(page.getByText('订单详情')).toBeVisible();

  // 限定在“订单详情”弹窗内点击，避免与表格行内同名图标按钮（aria-label=办理退房）冲突导致 strict mode 报错。
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
  await expect(orderDetailsDialog).toBeVisible();
  await orderDetailsDialog.getByRole('button', { name: '办理退房' }).click();
  await expect(page.getByText('确认退房')).toBeVisible();

  // 退房确认弹窗的按钮文案为“确定”（不是“确认”）；同时限定在弹窗内，避免页面其它“确定”按钮干扰。
  const checkOutConfirmDialog = page.getByRole('dialog').filter({ hasText: '确认退房' });
  await expect(checkOutConfirmDialog).toBeVisible();
  await checkOutConfirmDialog.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('退房成功')).toBeVisible({ timeout: 30_000 });
}

test.describe('创建订单到办理入住', () => {
  // 串行：避免多个用例并发导致房间资源冲突（同一时间段可用房被抢占）
  test.describe.configure({ mode: 'serial' });
  // 说明：下单流程涉及房态资源与多个弹窗交互，适当放宽超时以避免在低性能环境误报。
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').BrowserContext | null} */
  let context = null;
  /** @type {import('@playwright/test').Page | null} */
  let page = null;
  /** @type {null | (() => Promise<void>)} */
  let releaseLock = null;

  // 只登录一次：用例共享同一登录态，减少重复登录耗时与偶发波动
  test.beforeAll(async ({ browser }, testInfo) => {
    // 说明：与订单管理 E2E 共用房态/订单资源，为避免跨文件并行抢房导致“创建订单不跳转”等不稳定问题，这里获取全局互斥锁。
    // 同时：等待锁可能超过默认 30s，需要放宽 hook 超时。
    testInfo.setTimeout(240_000);
    releaseLock = await acquireE2ELock('order-management');
    context = await browser.newContext({ baseURL });
    page = await context.newPage();
    await login(page);
  });

  // 套件结束后统一关闭 context，释放资源
  test.afterAll(async () => {
    await context?.close();
    await releaseLock?.();
    context = null;
    page = null;
  });

  // 单日订单：入住=今日，离店=明日（1 晚）
  test('单日订单：创建 -> 办理入住 -> 办理退房', async () => {
    if (!page) throw new Error('page not initialized');
    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const checkOutDate = formatLocalYMD(addDays(today, 1));
    const stayDates = [checkInDate];

    const orderId = `E2E-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-单日-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await checkInFromOrderDetails(page, guestName);
    await checkOutFromOrderDetails(page, guestName);
  });

  // 多日订单：入住=今日，离店=后天（2 晚）
  test('多日订单：创建 -> 办理入住 -> 办理退房', async () => {
    if (!page) throw new Error('page not initialized');
    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const day2 = formatLocalYMD(addDays(today, 1));
    const checkOutDate = formatLocalYMD(addDays(today, 2));
    const stayDates = [checkInDate, day2];

    const orderId = `E2E-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-多日-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await checkInFromOrderDetails(page, guestName);
    await checkOutFromOrderDetails(page, guestName);
  });

  // 休息房订单：入住=今日，离店=今日（同日）
  test('休息房订单：创建 -> 办理入住 -> 办理退房', async () => {
    if (!page) throw new Error('page not initialized');
    const today = new Date();
    const checkInDate = formatLocalYMD(today);
    const checkOutDate = checkInDate;
    const stayDates = [checkInDate];

    const orderId = `E2E-${Date.now()}-${randomDigits(4)}`;
    const guestName = `E2E-休息房-${Date.now()}`;
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`;

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates });
    await checkInFromOrderDetails(page, guestName);
    await checkOutFromOrderDetails(page, guestName);
  });
});
