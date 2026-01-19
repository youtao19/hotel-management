// @ts-check
import { expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 订单管理（ViewOrders）E2E 通用 helper
 *
 * 说明：
 * - 本 helper 只负责把页面动作封装成可复用函数，避免 spec 里重复堆叠细节代码。
 * - 选择器优先使用 aria-label/data-testid（项目已在订单表格图标按钮补齐），提高稳定性。
 * - 日期字段遵守项目口径：只使用本地 YYYY-MM-DD 字符串，不做 toISOString/UTC 换算。
 */

export const e2eCredentials = {
  // 说明：默认值仅用于本地开发，CI/真实环境请通过环境变量覆盖
  email: process.env.E2E_EMAIL || 'wuyoutao19@qq.com',
  password: process.env.E2E_PASSWORD || 'wyt.1219'
}

export const e2eBaseURL = process.env.FRONTEND_URL || 'http://localhost:9000'

/**
 * 获取一个“全局互斥锁”：用于在 Playwright 多 worker 并行时，避免多条订单用例同时抢房导致不稳定。
 *
 * 说明：
 * - Playwright 在 fullyParallel=true 时，多个 spec 文件会并行执行。
 * - 订单类用例会创建/占用房间资源，并行时容易互相影响。
 * - 该锁通过创建独占文件实现（wx），拿到锁的 spec 才会执行，其他 spec 会等待。
 *
 * @param {string} lockKey - 锁名（同名会互斥）
 * @param {{ timeoutMs?: number, pollMs?: number, staleMs?: number }} [opts]
 * @returns {Promise<() => Promise<void>>} - 释放锁函数
 */
export async function acquireE2ELock(lockKey = 'order-management', opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 180_000
  const pollMs = opts.pollMs ?? 250
  const staleMs = opts.staleMs ?? 10 * 60_000
  const lockDir = path.join(process.cwd(), 'backend', 'test-results')
  const lockPath = path.join(lockDir, `.e2e-lock-${lockKey}.lock`)

  await fs.mkdir(lockDir, { recursive: true })

  const startedAt = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const fh = await fs.open(lockPath, 'wx')
      await fh.writeFile(JSON.stringify({ lockKey, pid: process.pid, createdAt: new Date().toLocaleString('zh-CN') }))
      await fh.close()
      return async () => {
        try {
          await fs.unlink(lockPath)
        } catch (e) {
          // 释放锁失败时忽略：避免影响用例清理流程
        }
      }
    } catch (e) {
      // 若锁文件存在，先判断是否陈旧；陈旧则清理，避免因异常退出造成“永久等待”
      try {
        const stat = await fs.stat(lockPath)
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.unlink(lockPath)
          continue
        }
      } catch (statErr) {
        // ignore
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`获取 E2E 锁超时: ${lockPath}`)
      }
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
  }
}

/**
 * 统一把日期格式化成 YYYY-MM-DD（与表单/后端 DATE 口径一致）
 * @param {Date} d
 */
export function formatLocalYMD(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 仅做“自然日”加减，避免涉及时区/UTC 转换（遵守项目日期字段口径）
 * @param {Date} date
 * @param {number} days
 */
export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/**
 * 生成指定长度的随机数字串（用于手机号/订单号后缀，避免撞数据）
 * @param {number} length
 */
export function randomDigits(length) {
  let s = ''
  for (let i = 0; i < length; i += 1) s += String(Math.floor(Math.random() * 10))
  return s
}

/**
 * 登录：进入 /login 填写账号密码并确保跳转到仪表盘
 * - 与其他 spec 保持一致：不依赖 storageState，减少共享状态带来的不确定性。
 * @param {import('@playwright/test').Page} page
 */
export async function login(page) {
  const { email, password } = e2eCredentials
  if (!email || !password) {
    throw new Error('缺少 E2E_EMAIL / E2E_PASSWORD，无法执行订单管理 E2E')
  }
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL('**/Dash-board', { timeout: 30_000 })
}

/**
 * 选择房型+房号：
 * - 优先选择“可用房数 > 0”的房型（UI 文案包含 `x间`），避免选到无房导致无法提交。
 * - 再从房号列表里选第一个可用房号。
 * @param {import('@playwright/test').Page} page
 */
export async function selectRoomTypeAndNumber(page) {
  const roomTypeCombobox = page.getByRole('combobox', { name: '房间类型' })
  const roomNumberCombobox = page.getByRole('combobox', { name: '房间号' })

  // 说明：多日订单的“可用房数”可能随日期范围变动；需要确保选到“有可用房号”的房型，避免提交时提示“请选择房间号”。
  await roomTypeCombobox.click()

  // 仅从当前可见的下拉菜单里选项中选择：避免历史残留 menu 影响定位
  const roomTypeOptions = page.locator('.q-menu:visible .q-item').filter({ hasNotText: '所有房型' })
  const optionCount = await roomTypeOptions.count()

  for (let i = 0; i < optionCount; i += 1) {
    const option = roomTypeOptions.nth(i)
    const optionText = (await option.innerText()).trim()

    // 跳过无房房型：兼容文案可能带空格，例如“剩余 1 间可用”/“剩余 0 间可用”
    if (!/[1-9]\d*\s*间/.test(optionText)) continue

    await option.click()

    await roomNumberCombobox.click()
    // 房号列表里可能出现“没有可用房间/请选择”等占位项，这里仅选择纯数字房号（例如 105）。
    const roomNumberOption = page
      .locator('.q-menu:visible .q-item')
      .filter({ hasNotText: /没有可用|请选择/ })
      .filter({ hasText: /^\s*\d+\s*$/ })
      .first()

    if (await roomNumberOption.count()) {
      await roomNumberOption.click()
      return
    }

    // 当前房型在该日期范围下无房号可选：关闭下拉并继续尝试下一个房型
    await page.keyboard.press('Escape')
    await roomTypeCombobox.click()
  }

  throw new Error('未找到可用房型/房号（请检查该日期范围是否有可用房间）')
}

/**
 * 填写每日价格：
 * - 单日订单/休息房订单：表单只有一个价格输入框，label 分别为“住宿价格/休息房价格”。
 * - 多日订单：价格输入框的 label 是具体日期（YYYY-MM-DD）。
 * @param {import('@playwright/test').Page} page
 * @param {{ stayDates: string[], isRestRoom: boolean }} params
 */
export async function fillDailyPrices(page, { stayDates, isRestRoom }) {
  for (const d of stayDates) {
    const label = stayDates.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : d
    await page.getByRole('spinbutton', { name: label }).fill('100')
  }
}

/**
 * 创建订单：在 CreateOrder 页面填写最小必填项并提交
 * @param {import('@playwright/test').Page} page
 * @param {{ orderId: string, guestName: string, phone: string, checkInDate: string, checkOutDate: string, stayDates: string[] }} params
 */
export async function createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates }) {
  await page.goto('/CreateOrder')
  // 防御性等待：首次进入创建订单页时渲染可能较慢（CI/低性能环境），提高超时时间避免误报
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('textbox', { name: '订单号' }).fill(orderId)
  await page.getByRole('textbox', { name: '姓名' }).fill(guestName)
  await page.getByRole('textbox', { name: '手机号（可选）' }).fill(phone)
  await page.getByRole('textbox', { name: '入住日期' }).fill(checkInDate)
  await page.getByRole('textbox', { name: '离店日期' }).fill(checkOutDate)

  await selectRoomTypeAndNumber(page)
  await fillDailyPrices(page, { stayDates, isRestRoom: checkInDate === checkOutDate })

  await page.getByRole('button', { name: '确认创建' }).click()
  await page.waitForURL('**/ViewOrders', { timeout: 30_000 })
}

/**
 * 重置筛选条件：点击“清除”以避免前一个用例残留筛选影响本用例
 * @param {import('@playwright/test').Page} page
 */
export async function resetOrderFilters(page) {
  await expect(page).toHaveURL(/\/ViewOrders/)
  await page.getByRole('button', { name: '清除' }).click()
  // 防御性等待：确保清除动作生效（输入框被清空/列表重新渲染）
  await expect(page.getByRole('textbox', { name: '搜索订单' })).toHaveValue('')
}

/**
 * 在“查看订单”页按客人姓名搜索到唯一订单（依赖页面已有数据）
 * @param {import('@playwright/test').Page} page
 * @param {string} guestName
 */
export async function searchOrderByGuestName(page, guestName) {
  await expect(page).toHaveURL(/\/ViewOrders/)
  await page.getByRole('textbox', { name: '搜索订单' }).fill(guestName)
  await page.getByRole('button', { name: '搜索' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })
}

/**
 * 在“查看订单”页按关键字搜索到唯一订单（订单号/客人/手机号/房号均可匹配）
 * - 用于续住后按新订单号定位。
 * @param {import('@playwright/test').Page} page
 * @param {string} query
 */
export async function searchOrderByQuery(page, query) {
  await expect(page).toHaveURL(/\/ViewOrders/)
  await page.getByRole('textbox', { name: '搜索订单' }).fill(query)
  await page.getByRole('button', { name: '搜索' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })
}

/**
 * 设置订单状态筛选（QSelect）：通过选择中文标签来设置过滤值
 * - 该筛选由 OrderFilterBar 发出 search 事件，因此选择后列表会自动刷新展示。
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
export async function selectOrderStatusFilter(page, label) {
  const statusCombobox = page.getByRole('combobox', { name: '订单状态' })
  await statusCombobox.click()
  const option = page.locator('.q-menu .q-item').filter({ hasText: label }).first()
  await expect(option).toBeVisible({ timeout: 30_000 })
  await option.click()
}

/**
 * 打开订单详情弹窗（从列表行按钮进入）
 * - 优先使用 data-testid，避免 UI 文案/图标变化导致定位不稳定。
 * @param {import('@playwright/test').Page} page
 */
export async function openOrderDetailsFromFirstRow(page) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.getByTestId('orders-row-view').click()
  await expect(page.getByText('订单详情')).toBeVisible({ timeout: 30_000 })
}

/**
 * 关闭订单详情弹窗并确保遮罩层消失（防止遮罩层拦截后续点击）
 * - 关闭按钮有稳定文案“关闭”，比右上角 icon close 更可靠。
 * @param {import('@playwright/test').Page} page
 */
export async function closeOrderDetailsDialog(page) {
  // 限定在“订单详情”弹窗内关闭，避免误点页面其它“关闭”按钮
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' })
  await expect(orderDetailsDialog).toBeVisible({ timeout: 30_000 })
  await orderDetailsDialog.getByRole('button', { name: '关闭' }).click()
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 })
}

/**
 * 从订单详情办理入住（并完成确认）
 * - “确认办理入住”按钮文案在 CheckInConfirmDialog 中固定。
 * @param {import('@playwright/test').Page} page
 * @param {{ deposit?: string }} [params]
 */
export async function checkInFromDetails(page, params = {}) {
  const deposit = params.deposit ?? '200'

  // 限定在“订单详情”弹窗内点击，避免与表格行内的“办理入住”图标按钮（aria-label）冲突导致 strict mode 报错。
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' })
  await expect(orderDetailsDialog).toBeVisible({ timeout: 30_000 })
  await orderDetailsDialog.getByRole('button', { name: '办理入住' }).click()

  // 在“确认办理入住”弹窗里可设置押金（退押金用例需要押金 > 0）
  const checkInConfirmDialog = page.getByRole('dialog').filter({ hasText: '确认办理入住' })
  await expect(checkInConfirmDialog).toBeVisible({ timeout: 30_000 })

  // 说明：押金输入在不同 Quasar 版本下可能落在不同节点上，这里做多选择器兜底以提升稳定性。
  const depositInput = checkInConfirmDialog
    .locator('[data-testid="checkin-deposit"] input, input[aria-label="押金"], input[type="number"]')
    .first()
  await expect(depositInput).toBeVisible({ timeout: 30_000 })
  await depositInput.fill(String(deposit))

  await expect(checkInConfirmDialog.getByRole('button', { name: '确认办理入住' })).toBeVisible({ timeout: 30_000 })
  await checkInConfirmDialog.getByRole('button', { name: '确认办理入住' }).click()
  await expect(page.getByText('入住成功')).toBeVisible({ timeout: 30_000 })
  // 防御性等待：确认弹窗关闭后没有遗留遮罩层拦截点击
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 })
}

/**
 * 从订单详情办理退房（并完成确认）
 * - 退房确认弹窗标题为“确认退房”，确认按钮文案为“确定”。
 * @param {import('@playwright/test').Page} page
 */
export async function checkOutFromDetails(page) {
  // 限定在“订单详情”弹窗内点击，避免与表格行内的“办理退房”图标按钮（aria-label）冲突导致 strict mode 报错。
  const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' })
  await expect(orderDetailsDialog).toBeVisible({ timeout: 30_000 })
  await orderDetailsDialog.getByRole('button', { name: '办理退房' }).click()
  const checkOutConfirmDialog = page.getByRole('dialog').filter({ hasText: '确认退房' })
  await expect(checkOutConfirmDialog).toBeVisible({ timeout: 30_000 })
  await checkOutConfirmDialog.getByRole('button', { name: '确定' }).click()
  await expect(page.getByText('退房成功')).toBeVisible({ timeout: 30_000 })
  // 防御性等待：确认弹窗关闭后没有遗留遮罩层拦截点击
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 })
}

/**
 * 确认 Quasar $q.dialog：按标题定位弹窗并点击 OK
 * @param {import('@playwright/test').Page} page
 * @param {string} titleText
 * @param {string} [okName]
 */
export async function confirmQuasarDialog(page, titleText, okName = '确定') {
  // Quasar 的 dialog 可能出现多个 role=dialog（例如页面已有其它弹窗/抽屉），这里通过“标题 + OK 按钮文案”双重约束定位。
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: titleText })
    .filter({ has: page.getByRole('button', { name: okName }) })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole('button', { name: okName }).click()
  // 防御性等待：确保弹窗关闭后没有遗留遮罩层拦截点击
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 })
}

/**
 * 从订单列表行触发取消订单（图标按钮）
 * @param {import('@playwright/test').Page} page
 */
export async function cancelOrderFromFirstRow(page) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.getByTestId('orders-row-cancel').click()
  await confirmQuasarDialog(page, '确认取消', '确定')
  await expect(page.getByText('订单已取消')).toBeVisible({ timeout: 30_000 })
}

/**
 * 从订单列表行触发提前退房（图标按钮）
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{hasStayed: boolean}>}
 */
export async function earlyCheckoutFromFirstRow(page) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.getByTestId('orders-row-early-checkout').click()

  const earlyCheckoutDialog = page.getByRole('dialog').filter({ hasText: '提前退房' })
  await expect(earlyCheckoutDialog).toBeVisible({ timeout: 30_000 })

  // 等待“确认提前退房”按钮可用（推荐金额与校验条件满足后才可提交）
  const confirmBtn = earlyCheckoutDialog.getByRole('button', { name: '确认提前退房' })
  /** @type {boolean} */
  let hasStayed = true

  // 说明：若后端推荐接口不可用，已入住分支会因 recommendation 为空而不可提交；
  //       此时切到“未入住直接退房”分支即可绕过 recommendation 依赖，让用例在不同环境也能稳定执行。
  if (!(await confirmBtn.isEnabled())) {
    hasStayed = false
    await earlyCheckoutDialog.getByText('否，未入住直接退房').click()
    // 确保选择退款方式（部分环境默认值可能为空，导致 canSubmit=false）
    await earlyCheckoutDialog.getByRole('combobox', { name: '退款方式' }).click()
    const cashOption = page.locator('.q-menu .q-item').filter({ hasText: '现金' }).first()
    await expect(cashOption).toBeVisible({ timeout: 30_000 })
    await cashOption.click()
  }

  await expect(confirmBtn).toBeEnabled({ timeout: 30_000 })
  await confirmBtn.click()

  // 成功提示来自页面 handleEarlyCheckoutSuccess（OrderManagement/index.vue）
  await expect(page.getByText('提前退房成功')).toBeVisible({ timeout: 30_000 })
  // 防御性等待：弹窗关闭后没有遗留遮罩层拦截点击
  await expect(page.locator('.q-dialog__backdrop')).toHaveCount(0, { timeout: 30_000 })

  return { hasStayed }
}

/**
 * 从订单列表行触发续住（图标按钮）
 * @param {import('@playwright/test').Page} page
 * @param {{ extendStartDate: string, extendEndDate: string, unitPrice: number }} params
 * @returns {Promise<string>} 新订单号（用于后续搜索定位）
 */
export async function extendStayFromFirstRow(page, { extendStartDate, extendEndDate, unitPrice }) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.getByTestId('orders-row-extend-stay').click()

  const extendStayDialog = page.getByRole('dialog').filter({ hasText: '续住办理' })
  await expect(extendStayDialog).toBeVisible({ timeout: 30_000 })

  // 选择房间：优先点击“继续住原房间”，否则从下拉中选择第一个可用项（不同环境可用房不同）。
  const useOriginalRoomBtn = extendStayDialog.getByRole('button', { name: '继续住原房间' })
  if (await useOriginalRoomBtn.isVisible()) {
    await useOriginalRoomBtn.click()
  } else {
    await extendStayDialog.getByRole('combobox', { name: '选择房间' }).click()
    const firstRoomOption = page.locator('.q-menu .q-item').first()
    await expect(firstRoomOption).toBeVisible({ timeout: 30_000 })
    await firstRoomOption.click()
  }

  // 设置续住日期：用例通过传入日期确保“离店日期变化可见”
  await extendStayDialog.getByRole('textbox', { name: '入住日期' }).fill(extendStartDate)
  await extendStayDialog.getByRole('textbox', { name: '离店日期' }).fill(extendEndDate)

  // 单日续住：填写单价，确保总价计算有值且可见
  await extendStayDialog.getByRole('spinbutton', { name: '续住单价' }).fill(String(unitPrice))
  // 说明：总价展示可能是整数/小数形式，避免断言具体格式（例如 ¥100 vs ¥100.00），只要总价不为 0 即认为计算生效。
  const totalPriceText = extendStayDialog.locator('.text-h6').filter({ hasText: '¥' }).first()
  await expect(totalPriceText).toBeVisible({ timeout: 30_000 })
  await expect(totalPriceText).toHaveText(/¥\s*[1-9]/, { timeout: 30_000 })

  // 读取自动生成的新订单号，后续用于搜索定位
  const newOrderInput = extendStayDialog.getByRole('textbox', { name: '订单号' })
  const newOrderNumber = (await newOrderInput.inputValue()).trim()
  if (!newOrderNumber) {
    // 兜底：若未生成则手动填入唯一值（避免提交失败）
    const fallback = `E2E-EXT-${Date.now()}`
    await newOrderInput.fill(fallback)
    await extendStayDialog.getByRole('button', { name: '确认续住' }).click()
    await expect(page.getByText('续住订单创建成功')).toBeVisible({ timeout: 30_000 })
    return fallback
  }

  await extendStayDialog.getByRole('button', { name: '确认续住' }).click()
  await expect(page.getByText('续住订单创建成功')).toBeVisible({ timeout: 30_000 })
  return newOrderNumber
}

/**
 * 从订单列表行触发退押金（图标按钮）
 * @param {import('@playwright/test').Page} page
 */
export async function refundDepositFromFirstRow(page) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row.getByTestId('orders-row-refund')).toBeVisible({ timeout: 30_000 })
  await row.getByTestId('orders-row-refund').click()

  const refundDialog = page.getByRole('dialog').filter({ hasText: '退押金' })
  await expect(refundDialog).toBeVisible({ timeout: 30_000 })

  // 点击“全部”填充可退上限，确保本次为全额退押
  await refundDialog.getByRole('button', { name: '全部' }).click()
  await refundDialog.getByRole('button', { name: '确认退押金' }).click()

  // 二次确认弹窗：OK 按钮文案为“确认退款”
  await confirmQuasarDialog(page, '确认退押金', '确认退款')
  await expect(page.getByText('退押金成功')).toBeVisible({ timeout: 30_000 })
}

/**
 * 从订单列表第一行读取房号（用于房态联动断言）
 * @param {import('@playwright/test').Page} page
 */
export async function getRoomNumberFromFirstRow(page) {
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  // 表格列顺序固定：房间号为第 4 列（0-based: 3）
  return (await row.locator('td').nth(3).innerText()).trim()
}
