"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIGRATION_FILE_PATTERN = /^\d{8,14}_[a-z0-9_-]+\.sql$/i;
const MIGRATION_LOCK_KEY = 814203671;
const migrationsDir = __dirname;

/**
 * 读取按文件名排序的迁移；文件名中的时间序列决定所有环境的执行顺序。
 * @param {string} directory 迁移目录
 * @returns {Array<{name: string, sql: string, checksum: string}>} 待执行迁移
 */
function loadMigrations(directory = migrationsDir) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => {
      const filePath = path.join(directory, entry.name);
      const sql = fs.readFileSync(filePath, "utf8");

      if (!sql.trim()) {
        throw new Error(`迁移文件不能为空: ${entry.name}`);
      }

      return {
        name: entry.name,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex")
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * 建立迁移状态表；它独立于业务表，保证已执行迁移在后续发布中不会重复执行。
 * @param {{query: Function}} client 数据库连接
 * @returns {Promise<void>}
 */
async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * 执行所有未登记迁移，并拒绝已执行文件被改写的情况，避免不同环境结构漂移。
 * @param {{query: Function}} client 已获取的 PostgreSQL 连接
 * @param {{migrationsDir?: string, logger?: Pick<Console, "info">}} options 迁移选项
 * @returns {Promise<string[]>} 本次成功执行的迁移文件名
 */
async function runMigrations(client, options = {}) {
  const directory = options.migrationsDir || migrationsDir;
  const logger = options.logger || console;
  const migrations = loadMigrations(directory);
  const appliedNames = [];
  let lockAcquired = false;

  await ensureMigrationTable(client);
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  lockAcquired = true;

  try {
    const appliedResult = await client.query("SELECT name, checksum FROM schema_migrations");
    const appliedByName = new Map(appliedResult.rows.map((row) => [row.name, row.checksum]));

    for (const migration of migrations) {
      const recordedChecksum = appliedByName.get(migration.name);
      if (recordedChecksum) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(`已执行的迁移文件不能修改: ${migration.name}`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum]
        );
        await client.query("COMMIT");
        appliedNames.push(migration.name);
        logger.info(`已执行迁移: ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`迁移失败 ${migration.name}: ${error.message}`);
      }
    }

    return appliedNames;
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  }
}

/**
 * 直接运行脚本时加载本地环境并执行迁移；应用服务本身不会自动调用此入口。
 * @returns {Promise<void>}
 */
async function main() {
  const projectRoot = path.resolve(__dirname, "../../../..");
  const envFile = process.env.NODE_ENV === "test" ? ".env.test" : "dev.env";
  require("dotenv").config({ path: path.join(projectRoot, envFile) });

  const db = require("../pg");
  db.createPool();
  let client;

  try {
    client = await db.getClient();
    const appliedNames = await runMigrations(client);
    console.info(appliedNames.length ? `迁移完成，共执行 ${appliedNames.length} 个文件。` : "数据库已是最新版本。");
  } finally {
    if (client) client.release();
    await db.closePool();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATION_FILE_PATTERN,
  ensureMigrationTable,
  loadMigrations,
  runMigrations
};
