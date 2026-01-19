// @ts-check
import { test, expect } from '@playwright/test'
import {
  acquireE2ELock,
  addDays,
  createOrder,
  e2eBaseURL,
  formatLocalYMD,
  login,
  randomDigits,
  resetOrderFilters,
  searchOrderByGuestName,
  selectOrderStatusFilter,
  openOrderDetailsFromFirstRow,
  closeOrderDetailsDialog,
  checkInFromDetails,
  checkOutFromDetails
} from './helpers/orderManagement.e2e.helper.js'

/**
 * 订单管理（ViewOrders）- 搜索/详情弹窗/状态筛选+状态流转
 *
 * 说明：
 * - 本文件只覆盖“列表与详情”相关能力，避免单文件过长。
 * - 串行执行：订单创建会占用房态资源，避免并发抢房导致不稳定。
 */

test.describe('订单管理（ViewOrders）- 搜索与详情', () => {
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

  test('订单列表搜索：能定位刚创建的订单', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-搜索-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    const row = page.locator('tbody tr').first()
    await expect(row).toContainText(guestName)
    await expect(row).toContainText(orderId)
  })

  test('订单详情弹窗：可重复打开/关闭且遮罩层清零', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-弹窗-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // 第一次打开/关闭
    await openOrderDetailsFromFirstRow(page)
    await closeOrderDetailsDialog(page)

    // 第二次打开/关闭（回归：避免遗留遮罩层导致后续点击失效）
    await openOrderDetailsFromFirstRow(page)
    await closeOrderDetailsDialog(page)
  })

  test('状态筛选：随办理入住/退房流转正确（待入住 -> 已入住 -> 已退房）', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-筛选-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)

    // 1) 待入住：搜索 + 选择“已入住”应无结果，再切回“待入住”应命中
    await searchOrderByGuestName(page, guestName)
    await selectOrderStatusFilter(page, '已入住')
    await expect(page.getByText('没有找到订单')).toBeVisible({ timeout: 30_000 })
    await selectOrderStatusFilter(page, '待入住')
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('待入住')

    // 2) 办理入住：从详情弹窗完成确认后，筛选“已入住”应命中
    await openOrderDetailsFromFirstRow(page)
    await checkInFromDetails(page, { deposit: '200' })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await selectOrderStatusFilter(page, '已入住')
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('已入住')

    // 3) 办理退房：从详情弹窗完成确认后，筛选“已退房”应命中
    await openOrderDetailsFromFirstRow(page)
    await checkOutFromDetails(page)
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await selectOrderStatusFilter(page, '已退房')
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('已退房')
  })
})
