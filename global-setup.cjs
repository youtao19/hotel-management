"use strict";

const fs = require("fs");
const path = require("path");
const { chromium, request } = require("@playwright/test");

// 轻量加载 .env.test，避免依赖额外包。
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    // 测试环境需要强制覆盖，避免被本机已有环境变量污染。
    process.env[key] = value;
  }
}

module.exports = async () => {
  const projectRoot = __dirname;
  const envPath = path.join(projectRoot, ".env.test");

  // 显式设置测试环境，确保只连接 test 数据库。
  loadEnvFile(envPath);
  process.env.NODE_ENV = "test";

  const db = require("./backend/database/postgreDB/pg");

  // 数据库迁移/初始化（幂等）。
  await db.initializePostgreDB();

  // 导入 room_types.sql（幂等 upsert），保证测试环境房型数据一致。
  const roomTypesSqlPath = path.join(projectRoot, "sql", "room_types.sql");
  if (fs.existsSync(roomTypesSqlPath)) {
    const roomTypesSql = fs.readFileSync(roomTypesSqlPath, "utf8");
    const statements = roomTypesSql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      if (/^INSERT\s+INTO\s+public\.room_types/i.test(stmt)) {
        const upsertStmt = `${stmt} ON CONFLICT (type_code) DO UPDATE SET type_name = EXCLUDED.type_name, base_price = EXCLUDED.base_price, description = EXCLUDED.description, is_closed = EXCLUDED.is_closed`;
        await db.query(upsertStmt);
      } else {
        await db.query(stmt);
      }
    }
  }

  // 导入 rooms.sql（幂等 upsert），确保房间数据来自项目自带 SQL。
  const roomsSqlPath = path.join(projectRoot, "sql", "rooms.sql");
  if (fs.existsSync(roomsSqlPath)) {
    const roomsSql = fs.readFileSync(roomsSqlPath, "utf8");
    const statements = roomsSql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      if (/^INSERT\s+INTO\s+public\.rooms/i.test(stmt)) {
        const upsertStmt = `${stmt} ON CONFLICT (room_number) DO UPDATE SET type_code = EXCLUDED.type_code, status = EXCLUDED.status, price = EXCLUDED.price, is_closed = EXCLUDED.is_closed`;
        await db.query(upsertStmt);
      } else {
        await db.query(stmt);
      }
    }
  }

  // 清理测试环境订单数据，避免历史订单占用导致“无可用房间”。
  await db.query("DELETE FROM orders");

  // 登录态初始化：通过前端页面登录并保存 storageState。
  const frontendUrl =
    process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:9011";
  const requestContext = await request.newContext({ baseURL: frontendUrl });

  const ensureOk = async (response, stepName) => {
    if (response.ok()) {
      return;
    }
    const responseText = await response.text();
    throw new Error(
      `${stepName} failed: ${response.status()} ${response.url()} ${responseText}`
    );
  };

  const seedUser = {
    // 使用固定账号，避免触发注册/IP 限流。
    email: process.env.E2E_EMAIL,
    pw: process.env.E2E_PASSWORD,
  };

  if (!seedUser.email || !seedUser.pw) {
    throw new Error("缺少 E2E_EMAIL 或 E2E_PASSWORD，请先配置后再运行 E2E");
  }

  // 同步给测试用例使用的环境变量（如 login.spec.js）。
  process.env.FRONTEND_URL = process.env.APP_URL || "http://localhost:9000";

  const healthResponse = await requestContext.get("/api/hup");
  await ensureOk(healthResponse, "E2E healthcheck");

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: frontendUrl });
  await page.goto("/login");
  // 等待登录页完成静态资源加载，避免跳转前写入 cookie 失败。
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="email"]').fill(seedUser.email);
  await page.locator('input[type="password"]').fill(seedUser.pw);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("**/Dash-board", { timeout: 30_000 });
  // 确保会话在后端已持久化完成。
  await page.waitForTimeout(1000);

  const storageStatePath = path.join(
    projectRoot,
    "backend",
    "tests",
    "e2e",
    "storageState.json"
  );
  await page.context().storageState({ path: storageStatePath });
  await page.close();
  await browser.close();
  await requestContext.dispose();
  await db.closePool();
};
