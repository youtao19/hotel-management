// @ts-check
import { test, expect } from '@playwright/test'
import {
  acquireE2ELock,
  addDays,
  cancelOrderFromFirstRow,
  checkInFromDetails,
  createOrder,
  e2eBaseURL,
  formatLocalYMD,
  login,
  openOrderDetailsFromFirstRow,
  randomDigits,
  resetOrderFilters,
  searchOrderByGuestName
} from './helpers/orderManagement.e2e.helper.js'

/**
 * 订单管理（ViewOrders）- 取消订单
 *
 * 覆盖：
 * - pending / checked-in 可取消
 * - 取消后状态变更且不可再办理入住/退房（按钮显隐）
 */

test.describe('订单管理（ViewOrders）- 取消订单', () => {
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

  test('取消订单：pending 可取消；取消后不可再办理入住/退房', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-取消P-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    await cancelOrderFromFirstRow(page)

    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('已取消')
    // 取消后操作按钮应消失：不可再入住/退房
    await expect(row.getByTestId('orders-row-check-in')).toHaveCount(0)
    await expect(row.getByTestId('orders-row-checkout')).toHaveCount(0)

    // 详情弹窗里也不应出现办理入住/退房按钮
    await openOrderDetailsFromFirstRow(page)
    const orderDetailsDialog = page.getByRole('dialog').filter({ hasText: '订单详情' })
    await expect(orderDetailsDialog.getByRole('button', { name: '办理入住' })).toHaveCount(0)
    await expect(orderDetailsDialog.getByRole('button', { name: '办理退房' })).toHaveCount(0)
  })

  test('取消订单：checked-in 可取消；取消后不可再退房/提前退房', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-取消CI-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // 先办理入住，得到 checked-in 状态
    await openOrderDetailsFromFirstRow(page)
    await checkInFromDetails(page, { deposit: '200' })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('已入住')

    // checked-in 状态可取消
    await cancelOrderFromFirstRow(page)
    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('已取消')
    // 取消后不可再退房/提前退房
    await expect(row.getByTestId('orders-row-checkout')).toHaveCount(0)
    await expect(row.getByTestId('orders-row-early-checkout')).toHaveCount(0)
  })
})
