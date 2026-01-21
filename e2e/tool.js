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
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取日期字符串（入住/离店）
 */
function getDateRangeStrings(nights) {
  const checkIn = new Date();
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + nights);
  return {
    checkInDate: formatDate(checkIn),
    checkOutDate: formatDate(checkOut)
  };
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

/**
 * 随机选择房间号
 */
async function selectRoomNumber(page) {
  // 1. 点击“房间号”下拉框展开列表
  const roomNumberSelect = page.getByRole('combobox', { name: '房间号' });
  await expect(roomNumberSelect).toBeEnabled();
  await roomNumberSelect.click();

  // 2. 仅选取当前可见的下拉菜单，避免多个菜单干扰
  const menu = page.locator('.q-menu:visible').first();
  await expect(menu).toBeVisible();

  // 3. 获取菜单中的所有选项
  const roomOptions = menu.locator('.q-item');
  const count = await roomOptions.count();

  if (count > 0) {
    // 4. 随机选择一个房间号
    const randomIndex = Math.floor(Math.random() * count);
    const selectedText = await roomOptions.nth(randomIndex).innerText();
    console.log(`随机选择了房间号: ${selectedText}`);
    await roomOptions.nth(randomIndex).click();
  } else {
    throw new Error('没有可用房间号可选择');
  }
}

/**
 * 创建单日订单
 */
async function createOrder(page) {
  await page.goto('http://localhost:9011/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();

  // 填写订单信息

  const guestName = generateGuestName();
  const phoneNumber = generatePhoneNumber();

  // 输入姓名、手机号
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phoneNumber);

  // 单日订单：系统默认入住/离店为当天，无需手动设置日期
  // 选择房型、房间
  await selectRoomType(page);
  await selectRoomNumber(page);

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

  // 返回本次创建的识别信息，便于后续筛选
  return { guestName, phoneNumber };
}

/**
 * 创建多日订单
 * 住 3 晚
 */
async function createMultiDayOrder(page) {
  await page.goto('http://localhost:9011/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();

  // 填写订单信息

  const guestName = generateGuestName();
  const phoneNumber = generatePhoneNumber();

  // 输入姓名、手机号
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phoneNumber);

  // 设置多日入住日期（住 3 晚）
  const { checkInDate, checkOutDate } = getDateRangeStrings(3);
  await page.getByLabel('入住日期').fill(checkInDate);
  await page.getByLabel('离店日期').fill(checkOutDate);

  // 选择房型、房间
  await selectRoomType(page);
  await selectRoomNumber(page);
  // 输入备注
  await page.getByRole('textbox', { name: '备注' }).fill('这是一个自动化测试多日订单，请勿处理。');
  await page.getByRole('button', { name: '确认创建' }).click();
  // 定位包含该文字且具有 positive 背景色的通知
  const successNotify = page.locator('.q-notification.bg-positive').filter({
    hasText: '订单创建成功！'
  });

  await expect(successNotify).toBeVisible();

  // 返回本次创建的识别信息，便于后续筛选
  return { guestName, phoneNumber };
}

/**
 * 创建休息房订单
 */
async function createRestOrder(page) {
  await page.goto('http://localhost:9011/CreateOrder');
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible();

  // 填写订单信息
  const guestName = generateGuestName();
  const phoneNumber = generatePhoneNumber();

  // 输入姓名、手机号
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName);
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phoneNumber);

  // 设置休息房日期（入住与离店同一天）
  const { checkInDate } = getDateRangeStrings(0);
  await page.getByLabel('入住日期').fill(checkInDate);
  await page.getByLabel('离店日期').fill(checkInDate);

  // 选择房型、房间
  await selectRoomType(page);
  await selectRoomNumber(page);
  // 输入备注
  await page.getByRole('textbox', { name: '备注' }).fill('这是一个自动化测试休息房订单，请勿处理。');
  await page.getByRole('button', { name: '确认创建' }).click();

  // 定位包含该文字且具有 positive 背景色的通知
  const successNotify = page.locator('.q-notification.bg-positive').filter({
    hasText: '订单创建成功！'
  });

  await expect(successNotify).toBeVisible();

  // 返回本次创建的识别信息，便于后续筛选
  return { guestName, phoneNumber };
}

/**
 * 通过搜索框筛选订单，避免并行时选到别人的订单
 */
async function filterOrdersByKeyword(page, keyword) {
  // 输入关键字并触发搜索
  await page.getByLabel('搜索订单').fill(keyword);
  await page.getByRole('button', { name: '搜索' }).click();
}

/**
 * 通过关键词找到待入住订单并办理入住
 */
async function checkInByKeyword(page, keyword) {
  // 确保在订单列表页
  await expect(page.getByText('订单列表')).toBeVisible();

  // 先筛选订单，避免并行冲突
  await filterOrdersByKeyword(page, keyword);

  // 等待出现“待入住”的订单行
  const pendingRow = page
    .locator('table tbody tr')
    .filter({ has: page.locator('.q-badge', { hasText: '待入住' }) })
    .first();
  await expect(pendingRow).toBeVisible();

  // 点击该行的“办理入住”按钮
  await pendingRow.getByTestId('orders-row-check-in').click();

  // 在弹出的办理入住对话框中，填写押金等信息
  await page.getByTestId('checkin-deposit').fill('100');
  await page.getByRole('button', { name: '确认办理入住' }).click();

  // 验证办理入住成功的通知
  const successNotify = page.locator('.q-notification.bg-positive').filter({
    hasText: '入住成功'
  });
  await expect(successNotify).toBeVisible();
}

/**
 * 办理入住
 */
async function checkIn(page) {
  const { guestName } = await createOrder(page);

  // 订单创建成功后会跳转到订单详情页
  await expect(page.getByText('订单列表')).toBeVisible();

  // 根据创建的客人姓名筛选订单
  await filterOrdersByKeyword(page, guestName);

  // 等待出现“待入住”的订单行
  const pendingRow = page
    .locator('table tbody tr')
    .filter({ has: page.locator('.q-badge', { hasText: '待入住' }) })
    .first();
  await expect(pendingRow).toBeVisible();

  // 点击该行的“办理入住”按钮（有稳定的 data-testid）
  await pendingRow.getByTestId('orders-row-check-in').click();

  // 在弹出的办理入住对话框中，填写押金等信息
  await page.getByTestId('checkin-deposit').fill('100');
  await page.getByRole('button', { name: '确认办理入住' }).click();

  // 验证办理入住成功的通知
  const successNotify = page.locator('.q-notification.bg-positive').filter({
    hasText: '入住成功'
  });

  await expect(successNotify).toBeVisible();

  // 返回本次办理入住对应的客人姓名，便于后续测试使用
  return { guestName };
}

module.exports = {
  createOrder,
  createMultiDayOrder,
  createRestOrder,
  checkIn,
  filterOrdersByKeyword,
  checkInByKeyword
};
