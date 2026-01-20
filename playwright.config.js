const fs = require('node:fs')
const path = require('node:path')
const { defineConfig } = require('@playwright/test')

// 加载 .env.test，确保测试用例可读取 E2E 账号与前端地址。
const envPath = path.join(__dirname, '.env.test')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    process.env[key] = value
  }
}

if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'http://localhost:9011'
}

// Playwright 配置：自动启动前后端服务，并复用 global-setup 的登录态。
module.exports = defineConfig({
  testDir: './backend/tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    baseURL: 'http://localhost:9011',
  },
  globalSetup: path.resolve(__dirname, 'global-setup.cjs'),
  webServer: [
    {
      command: 'npm --workspace backend run start:test',
      port: 3011,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm --workspace frontend run dev:test -- --port 9011',
      port: 9011,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PLAYWRIGHT: '1',
        VITE_API_BASE: 'http://localhost:3011',
      },
    },
  ],
})
