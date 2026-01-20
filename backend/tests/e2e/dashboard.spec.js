const { test, expect } = require('@playwright/test')

test('已登录用户可访问仪表盘', async ({ browser }) => {
  const baseURL = process.env.FRONTEND_URL || 'http://localhost:9011'
  const storageStatePath = `${process.cwd()}/backend/tests/e2e/storageState.json`
  const context = await browser.newContext({ baseURL, storageState: storageStatePath })
  const page = await context.newPage()

  // 直接访问受保护页面，使用 global-setup 生成的登录态。
  await page.goto('/Dash-board')

  // 断言页面关键文本出现，避免被路由守卫重定向到登录页。
  await expect(page.getByText('房间状态概览')).toBeVisible()
  await context.close()
})
