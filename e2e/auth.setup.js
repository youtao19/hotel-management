// e2e/auth.setup.js
const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../backend/database/postgreDB/pg');
const redisDB = require('../backend/database/redis/redis');

// 定义存储状态文件的路径
const authFile = path.join(__dirname, '../playwright/.auth/user.json');
// 定义 E2E 默认前端地址，允许通过环境变量覆盖
const defaultE2EBaseUrl = 'http://localhost:9011';
// 定义 E2E 默认账号名称
const defaultE2EAccountName = 'E2E测试账号';
// 定义 bcrypt 哈希轮数
const e2eSaltRounds = 10;

/**
 * 读取必填环境变量。
 * @param {string} variableName 环境变量名称
 * @returns {string} 环境变量值
 * @throws {Error} 环境变量缺失时抛出异常
 */
function getRequiredEnv(variableName) {
  const variableValue = String(process.env[variableName] || '').trim();
  if (!variableValue) {
    throw new Error(`缺少 E2E 必填环境变量：${variableName}`);
  }
  return variableValue;
}

/**
 * 获取 E2E 前端基础地址。
 * @returns {string} 前端基础地址
 * @throws {Error} 无
 */
function getE2EBaseUrl() {
  return String(process.env.E2E_BASE_URL || defaultE2EBaseUrl).trim();
}

/**
 * 按匹配模式删除 Redis 中的限流键。
 * @param {object} redisClient Redis 客户端
 * @param {string} keyPattern Redis 扫描模式
 * @returns {Promise<void>} 异步完成标记
 * @throws {Error} Redis 访问失败时抛出异常
 */
async function deleteRedisKeysByPattern(redisClient, keyPattern) {
  let cursor = '0';
  do {
    const scanResult = await redisClient.scan(cursor, {
      MATCH: keyPattern,
      COUNT: 100
    });
    cursor = scanResult.cursor;
    const matchedKeys = Array.isArray(scanResult.keys) ? scanResult.keys : [];
    if (matchedKeys.length > 0) {
      await redisClient.del(matchedKeys);
    }
  } while (cursor !== '0');
}

/**
 * 清理指定邮箱的登录限流状态，避免历史失败次数影响 E2E 登录。
 * @param {string} accountEmail E2E 登录邮箱
 * @returns {Promise<void>} 异步完成标记
 * @throws {Error} Redis 初始化失败时抛出异常
 */
async function clearE2ELoginRateLimit(accountEmail) {
  await redisDB.initialize();
  const redisClient = redisDB.getClient();
  if (!redisClient) {
    throw new Error('Redis 客户端未初始化，无法清理登录限流键');
  }
  await deleteRedisKeysByPattern(redisClient, `login_fail_consecutive_username_and_ip:${accountEmail}_*`);
}

/**
 * 创建或修正 E2E 登录账号，确保账号可登录。
 * @param {string} accountEmail E2E 登录邮箱
 * @param {string} accountPassword E2E 登录密码
 * @returns {Promise<void>} 异步完成标记
 * @throws {Error} 数据库写入失败时抛出异常
 */
async function ensureE2EAccountReady(accountEmail, accountPassword) {
  // 关键步骤：确保当前进程具备数据库连接池，再执行账号幂等写入。
  await db.initializePostgreDB();
  const passwordHash = await bcrypt.hash(accountPassword, e2eSaltRounds);
  await db.query(
    `INSERT INTO account (name, email, pw, created_at, email_verified)
     VALUES ($1, $2, $3, now(), TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       pw = EXCLUDED.pw,
       email_verified = TRUE`,
    [defaultE2EAccountName, accountEmail, passwordHash]
  );
  await clearE2ELoginRateLimit(accountEmail);
}

setup('登录并保存状态', async ({ page }) => {
  // 关键步骤：先保障账号存在且已验证，避免登录页因账号状态异常停留在 /login。
  const e2eEmail = getRequiredEnv('E2E_EMAIL');
  const e2ePassword = getRequiredEnv('E2E_PASSWORD');
  const e2eBaseUrl = getE2EBaseUrl();
  await ensureE2EAccountReady(e2eEmail, e2ePassword);

  // 1. 访问登录页面
  await page.goto(`${e2eBaseUrl}/login`);

  // 2. 输入账号密码 (使用你 .env.test 中的环境变量)
  // 假设你的 Quasar 登录页使用了这些选择器
  await page.getByLabel('邮箱').fill(e2eEmail);
  await page.getByLabel('密码').fill(e2ePassword);

  // 3. 点击登录按钮
  await page.getByRole('button', { name: '登录' }).click();

  // 4. 等待页面跳转到首页或仪表盘，确保登录成功
  await expect(page).toHaveURL(`${e2eBaseUrl}/Dash-board`);

  // 如果 setup 脚本保存状态太快，有些 LocalStorage 可能还没存进去
  await page.waitForLoadState('networkidle');

  // 5. 将当前的 Cookies 和 LocalStorage 保存到文件
  await page.context().storageState({ path: authFile });
});
