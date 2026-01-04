// @ts-check
import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const baseURL = process.env.FRONTEND_URL || 'http://localhost:9000';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalYMD(d) {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function randomDigits(length) {
  let s = '';
  for (let i = 0; i < length; i += 1) s += String(Math.floor(Math.random() * 10));
  return s;
}

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

async function selectRoomTypeAndNumber(page) {
  const roomTypeCombobox = page.getByRole('combobox', { name: '房间类型' });
  await roomTypeCombobox.click();

  const roomTypeOption = page
    .locator('.q-menu .q-item')
    .filter({ hasNotText: '所有房型' })
    .filter({ hasText: /[1-9]\d*间/ })
    .first();
  await expect(roomTypeOption).toBeVisible({ timeout: 30_000 });
  await roomTypeOption.click();

  const roomNumberCombobox = page.getByRole('combobox', { name: '房间号' });
  await roomNumberCombobox.click();
  const roomNumberOption = page.locator('.q-menu .q-item').first();
  await expect(roomNumberOption).toBeVisible({ timeout: 30_000 });
  await roomNumberOption.click();
}

async function fillDailyPrices(page, { stayDates, isRestRoom }) {
  for (const d of stayDates) {
    const label = stayDates.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : d;
    await page.getByRole('spinbutton', { name: label }).fill('100');
  }
}

async function createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates }) {
  await page.goto('/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();

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

async function checkInFromOrderDetails(page, guestName) {
  await expect(page).toHaveURL(/\/ViewOrders/);

  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName);
  await page.getByRole('button', { name: '搜索' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
  await page.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click();

  await expect(page.getByText('订单详情')).toBeVisible();
  await page.getByRole('button', { name: '办理入住' }).click();

  await expect(page.getByRole('button', { name: '确认办理入住' })).toBeVisible();
  await page.getByRole('button', { name: '确认办理入住' }).click();

  await expect(page.getByText('入住成功')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName);
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
  await page.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click();
  await expect(page.getByText('订单详情')).toBeVisible();
  const detailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' });
  await expect(detailsDialog.getByRole('status', { name: '已入住' })).toBeVisible();
}

test.describe('创建订单到办理入住', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').BrowserContext | null} */
  let context = null;
  /** @type {import('@playwright/test').Page | null} */
  let page = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await context?.close();
    context = null;
    page = null;
  });

  test('单日订单：创建 -> 办理入住', async () => {
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
  });

  test('多日订单：创建 -> 办理入住', async () => {
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
  });

  test('休息房订单：创建 -> 办理入住', async () => {
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
  });
});
