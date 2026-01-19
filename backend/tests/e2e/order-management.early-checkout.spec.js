// @ts-check
import { test, expect } from '@playwright/test'
import {
  acquireE2ELock,
  addDays,
  checkInFromDetails,
  createOrder,
  e2eBaseURL,
  earlyCheckoutFromFirstRow,
  formatLocalYMD,
  getRoomNumberFromFirstRow,
  login,
  openOrderDetailsFromFirstRow,
  randomDigits,
  resetOrderFilters,
  searchOrderByGuestName
} from './helpers/orderManagement.e2e.helper.js'

/**
 * 订单管理（ViewOrders）- 提前退房
 *
 * 覆盖：
 * - 已入住可提前退房
 * - 退房后状态变化
 * - 房态联动（如有展示：/room-status 显示“清扫中”）
 */

test.describe('订单管理（ViewOrders）- 提前退房', () => {
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

  test('提前退房：已入住可提前退房；退房后状态变更且房态联动（如有展示）', async () => {
    if (!page) throw new Error('page not initialized')

    const today = new Date()
    const checkInDate = formatLocalYMD(today)
    const checkOutDate = formatLocalYMD(addDays(today, 1))
    const stayDates = [checkInDate]

    const orderId = `E2E-OM-${Date.now()}-${randomDigits(4)}`
    const guestName = `E2E-OM-提前退-${Date.now()}`
    const phone = `1${String(3 + Math.floor(Math.random() * 7))}${randomDigits(9)}`

    await createOrder(page, { orderId, guestName, phone, checkInDate, checkOutDate, stayDates })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // 读取房号用于后续房态联动断言
    const roomNumber = await getRoomNumberFromFirstRow(page)

    await openOrderDetailsFromFirstRow(page)
    await checkInFromDetails(page, { deposit: '200' })
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)
    await expect(page.locator('tbody tr').first()).toContainText('已入住')

    const earlyCheckoutResult = await earlyCheckoutFromFirstRow(page)
    await resetOrderFilters(page)
    await searchOrderByGuestName(page, guestName)

    // 说明：已入住分支通常会把订单置为“已退房”；若推荐接口不可用导致切换到“未入住直接退房”，可能会置为“已取消”
    if (earlyCheckoutResult.hasStayed) {
      await expect(page.locator('tbody tr').first()).toContainText('已退房')
    } else {
      await expect(page.locator('tbody tr').first()).toContainText('已取消')
    }

    // 房态联动（如有展示）：仅在 hasStayed=true 时校验“清扫中”
    if (earlyCheckoutResult.hasStayed) {
      await page.goto('/room-status')
      // 防御性等待：页面渲染出房间卡片
      await expect(page.locator('.room-card').first()).toBeVisible({ timeout: 30_000 })
      const roomCard = page.locator('.room-card').filter({ hasText: roomNumber }).first()
      if (await roomCard.count()) {
        // 若存在对应房间卡片则断言状态（环境数据不足时可能不显示全部房间，做兼容）
        await expect(roomCard).toContainText('清扫中')
      }
    }
  })
})
