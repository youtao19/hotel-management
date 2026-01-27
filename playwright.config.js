// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './e2e',
  // 说明：E2E 共用同一个后端与数据库（见 webServer 配置），并发执行会导致
  // - 多用例同时占用/释放同一房间，触发业务失败，从而看不到“入住成功”等通知
  // - 部分用例在导入/清理数据时影响其他用例
  // 因此本地默认串行执行；如需并发可通过 PW_WORKERS 覆盖。
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  reporter: 'html',
  // 全局初始化与清理（测试数据准备/回收）
  globalSetup: path.join(__dirname, 'e2e/global-setup.js'),
  globalTeardown: path.join(__dirname, 'e2e/global-teardown.js'),

  use: {
    /* 这里的 URL 应该是你的前端 Quasar 地址 */
    baseURL: 'http://localhost:9011',
    trace: 'on-first-retry',
  },

  projects: [
    // --- 第一步：设置 Setup 项目 ---
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },

    // --- 第二步：正式测试项目 ---
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 关键：让这个项目使用 setup 产生的文件
        storageState: path.join(__dirname, 'playwright/.auth/user.json'),
      },
      // 关键：声明这个项目依赖于 'setup' 项目
      dependencies: ['setup'],
    },

    // ... 其他浏览器配置
  ],

  /* 使用数组同时监控前后端服务 */
  webServer: [
    {
      // 前端服务
      // 使用 dev:test 确保 PLAYWRIGHT=1，代理转发到 3011
      command: 'PORT=9011 npm run dev:test --workspace frontend', // 确保通过命令强制指定端口
      url: 'http://localhost:9011',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe', // 可选：将日志输出到控制台方便排查启动问题
      stderr: 'pipe',
    },
    {
      // 后端 Node.js 服务
      command: 'NODE_PORT=3011 npm run dev:test --workspace backend', // 替换为你真正的后端启动脚本
      // 使用后端健康检查路由，避免根路径非 200 导致等待超时
      url: 'http://localhost:3011/api/hup',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],
});
