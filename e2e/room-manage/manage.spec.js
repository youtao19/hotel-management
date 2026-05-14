const { test, expect } = require('@playwright/test');

test.describe('房间管理页面 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录状态由 setup 项目处理，这里直接访问页面
    await page.goto('/room-management');
    // 等待页面加载完成，检查关键元素
    await expect(page.locator('.room-content-card')).toBeVisible();
  });

  test('页面基础布局检查', async ({ page }) => {
    // 检查刷新按钮是否存在于卡片内
    const refreshBtn = page.locator('.room-content-card').getByRole('button', { name: '刷新' });
    await expect(refreshBtn).toBeVisible();

    // 检查 Tab 页签
    await expect(page.getByRole('tab', { name: '客房列表' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '房型定义' })).toBeVisible();
  });

  test('Tab 切换功能', async ({ page }) => {
    // 切换到房型定义
    await page.getByRole('tab', { name: '房型定义' }).click();
    await expect(page.getByText('房型配置')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增房型' })).toBeVisible();

    // 切换回客房列表
    await page.getByRole('tab', { name: '客房列表' }).click();
    await expect(page.getByText('所有客房')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增客房' })).toBeVisible();
  });

  test('打开新增客房弹窗', async ({ page }) => {
    await page.getByRole('button', { name: '新增客房' }).click();
    // 检查弹窗是否打开 (RoomDialog 内部通常有“保存”按钮)
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    // 关闭弹窗
    await page.keyboard.press('Escape');
  });

  test('筛选功能交互', async ({ page }) => {
    // 检查筛选栏是否存在
    const searchInput = page.getByPlaceholder('搜索房间号...');
    await expect(searchInput).toBeVisible();
    
    // 输入搜索内容
    await searchInput.fill('101');
    // 这里不需要点“应用筛选”按钮了（新 UI 移除了它，或者用了 debounce）
    // 等待表格过滤（这里只是演示交互，实际效果取决于数据）
    await page.waitForTimeout(500);
  });
});
