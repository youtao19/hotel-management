// @ts-check
import { test, expect } from '@playwright/test'
import {
  acquireE2ELock,
  addDays,
  checkInFromDetails,
  checkOutFromDetails,
  createOrder,
  e2eBaseURL,
  extendStayFromFirstRow,
  formatLocalYMD,
  login,
  openOrderDetailsFromFirstRow,
  randomDigits,
  resetOrderFilters,
  searchOrderByGuestName,
  searchOrderByQuery
} from './helpers/orderManagement.e2e.helper.js'

/**
 * 订单管理（ViewOrders）- 续住
 *
 * 覆盖：
 * - 已入住/已退房允许续住（本用例以“已退房”路径为主）
 * - 续住后新订单可搜索，离店日期可见（确保日期更新展示）
 */

test.describe('订单管理（ViewOrders）- 续住', () => {
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

  test('续住：已退房允许续住；续住后离店日期/费用更新可见', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]
    const extendStartDate = checkOutDate
    const extendEndDate = formatLocalYMD(addDays(today, 2))

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-续住-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // 先办理入住 -> 再办理退房，让订单进入 checked-out（续住允许 checked-in/checked-out）
    await openOrderDetailsFromFirstRow(page)
    await checkInFromDetails(page, { deposit: '200' })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await openOrderDetailsFromFirstRow(page)
    await checkOutFromDetails(page)
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('已退房')

    const newOrderNumber = await extendStayFromFirstRow(page, { extendStartDate, extendEndDate, unitPrice: 100 })

    // 按新订单号搜索，断言新订单存在且离店日期为选择的 extendEndDate
    await page.goto('/ViewOrders')
    await resetOrderFilters(page)
    await searchOrderByQuery(page, newOrderNumber)
    const newRow = page.locator('tbody tr').first()
    await expect(newRow).toContainText(newOrderNumber)
    await expect(newRow).toContainText(extendEndDate)
  })
})
