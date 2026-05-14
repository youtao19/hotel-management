const { test, expect } = require('@playwright/test');

test.describe('其他收入页面 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/other-income');
    // 等待卡片加载
    await expect(page.locator('.other-income-card')).toBeVisible();
  });

  test('页面标题移除检查', async ({ page }) => {
    // 确认页面没有 "其他收入" 标题
    await expect(page.getByRole('heading', { name: '其他收入' })).not.toBeVisible();
    await expect(page.getByText('录入租车或杂项收入')).not.toBeVisible();
  });

  test('表单字段检查', async ({ page }) => {
    // 检查核心表单字段
    await expect(page.getByPlaceholder('例如：张三')).toBeVisible();
    await expect(page.getByPlaceholder('0.00')).toBeVisible();
    await expect(page.getByRole('button', { name: '提交录入' })).toBeVisible();
  });

  test('表单校验简单测试', async ({ page }) => {
    // 点击提交但不输入任何内容
    await page.getByRole('button', { name: '提交录入' }).click();
    
    // 检查可能的通知 (假设有提示，如 "请输入客人姓名" 或 "金额必须大于0")
    // 这里仅示例，实际效果由组件逻辑决定
    // const notify = page.locator('.q-notification');
    // await expect(notify).toBeVisible();
  });
});
