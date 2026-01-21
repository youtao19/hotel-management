// e2e/order-manage/create.spec.js
const { test, expect } = require('@playwright/test');


/**
 * 随机生成姓名
 * 格式：姓氏 + 随机中文字符 + 时间戳后缀
 */
function generateGuestName() {
  const surnames = ['张', '王', '李', '赵', '钱', '孙', '周', '吴'];
  const randomSurname = surnames[Math.floor(Math.random() * surnames.length)];

  // 获取当前时间戳的最后 4 位，确保多次运行不重复且名字长度适中
  const uniqueId = Date.now().toString().slice(-4);

  return `${randomSurname}测试_${uniqueId}`;
}

/**
 * 随机生成手机号
 * 确保唯一性的逻辑：1 + 随机前两位 + 时间戳后 8 位
 */
function generatePhoneNumber() {
  // 中国手机号段前三位常见开头
  const prefixes = ['138', '139', '150', '188', '199', '177'];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];

  // Date.now() 返回 13 位数字，取后 8 位可以保证高频运行时的唯一性
  // 3 位前缀 + 8 位时间戳 = 11 位标准手机号
  const uniqueSuffix = Date.now().toString().slice(-8);

  return `${randomPrefix.slice(0, 3)}${uniqueSuffix}`;
}

/**
 * 随机选择有房间的房型
 */
async function selectRoomType(page) {
  // 1. 点击“房间类型”下拉框展开列表
  await page.getByRole('combobox', { name: '房间类型' }).click();

  // 2. 仅选取当前可见的下拉菜单，避免多个菜单干扰
  const menu = page.locator('.q-menu:visible').first();
  await expect(menu).toBeVisible();

  // 3. 获取菜单中的所有选项
  const roomOptions = menu.locator('.q-item');
  const count = await roomOptions.count();

  // 4. 优先筛选“可用数不为 0 间”的房型
  const availableIndexes = [];
  for (let i = 0; i < count; i += 1) {
    const badge = roomOptions.nth(i).locator('.q-badge');
    const badgeText = (await badge.textContent()) || '';
    if (badgeText.includes('间') && !badgeText.includes('0间')) {
      availableIndexes.push(i);
    }
  }

  if (availableIndexes.length > 0) {
    // 5. 随机选择一个有房的房型
    const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    const selectedText = await roomOptions.nth(randomIndex).innerText();
    console.log(`随机选择了房型: ${selectedText}`);
    await roomOptions.nth(randomIndex).click();
  } else {
    console.log('没有找到有剩余房间的房型');
  }
}


test('创建订单测试', async ({ page }) => {
  // 此时浏览器已经带有登录成功的 Cookies
  await page.goto('http://localhost:9011/Dash-board');

  await page.goto('http://localhost:9011/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();

  // 填写订单信息

  const guestName = generateGuestName();
  const phoneNumber = generatePhoneNumber();

  // 1.输入姓名、手机号
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phoneNumber);

  // 2.选择房型、房间
  await selectRoomType(page);

  // 当前立即收房费
  await page.getByRole('radio', { name: '是' }).check();

  // 输入备注
  await page.getByRole('textbox', { name: '备注' }).fill('这是一个自动化测试订单，请勿处理。');

  await page.getByRole('button', { name: '确认创建' }).click();

  // 定位包含该文字且具有 positive 背景色的通知
  const successNotify = page.locator('.q-notification.bg-positive').filter({
    hasText: '订单创建成功！'
  });

  await expect(successNotify).toBeVisible();
});
