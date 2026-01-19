// @ts-check
import { test, expect } from '@playwright/test'
import {
  acquireE2ELock,
  addDays,
  checkInFromDetails,
  checkOutFromDetails,
  createOrder,
  e2eBaseURL,
  formatLocalYMD,
  login,
  openOrderDetailsFromFirstRow,
  randomDigits,
  refundDepositFromFirstRow,
  resetOrderFilters,
  searchOrderByGuestName
} from './helpers/orderManagement.e2e.helper.js'

/**
 * 订单管理（ViewOrders）- 退押金
 *
 * 覆盖：
 * - 满足条件才显示“退押金”
 * - 点击后二次确认弹窗可点（确认退款）
 * - 成功 toast + 按钮消失（剩余押金=0 不可再退）
 */

test.describe('订单管理（ViewOrders）- 退押金', () => {
  test.describe.configure({ mode: 'serial' })

  /** @type {import('@playwright/test').BrowserContext | null} */
  let context = null
  /** @type {import('@playwright/test').Page | null} */
  let page = null
  /** @type {null | (() => Promise<void>)} */
  let releaseLock = null

  test.beforeAll(async ({ browser }, testInfo) => {
    // 说明：该 spec 会获取全局互斥锁，等待时间可能超过默认 30s，需要放宽 hook 超时
    testInfo.setTimeout(240_000)
    // 获取全局互斥锁：避免与其他订单用例并行抢房/抢资源
    releaseLock = await acquireE2ELock('order-management')
    context = await browser.newContext({ baseURL: e2eBaseURL })
    page = await context.newPage()
    await login(page)
  })

  test.afterAll(async () => {
    await context?.close()
    await releaseLock?.()
    context = null
    page = null
  })

  test('退押金：满足条件才显示；确认弹窗可点；成功后按钮消失且金额变化可见', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-退押-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // pending/checked-in 阶段不应展示“退押金”
    await expect(page.locator('tbody tr').first().getByTestId('orders-row-refund')).toHaveCount(0)

    // 办理入住（设置押金）-> 办理退房
    await openOrderDetailsFromFirstRow(page)
    await checkInFromDetails(page, { deposit: '200' })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await openOrderDetailsFromFirstRow(page)
    await checkOutFromDetails(page)
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // checked-out 且 押金>0 时，按钮应出现（computeRefundable 异步计算，给足等待）
    const row = page.locator('tbody tr').first()
    await expect(row.getByTestId('orders-row-refund')).toBeVisible({ timeout: 30_000 })
    await refundDepositFromFirstRow(page)

    // 成功后“退押金”按钮应消失（剩余押金为 0 时不可退）
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first().getByTestId('orders-row-refund')).toHaveCount(0, { timeout: 30_000 })
  })
})
