"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runMigrations } = require("../run-migrations");

/**
 * 创建隔离迁移目录，避免测试文件影响真实迁移目录的执行顺序。
 * @returns {string} 临时目录
 */
function createMigrationDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hotel-migrations-"));
}

/**
 * 创建可观察 SQL 调用的数据库连接替身；迁移单元测试不依赖真实 PostgreSQL。
 * @param {{appliedRows?: Array<{name: string, checksum: string}>, failSql?: string}} options 模拟选项
 * @returns {{client: {query: jest.Mock}, calls: Array<{text: string, params: unknown}>}} 连接与调用记录
 */
function createClient(options = {}) {
  const calls = [];
  const client = {
    query: jest.fn(async (text, params) => {
      calls.push({ text, params });
      if (text === "SELECT name, checksum FROM schema_migrations") {
        return { rows: options.appliedRows || [] };
      }
      if (options.failSql && text.includes(options.failSql)) {
        throw new Error("数据库拒绝该 SQL");
      }
      return { rows: [] };
    })
  };

  return { client, calls };
}

/**
 * 清理临时目录，防止测试运行遗留迁移文件。
 * @param {string} directory 临时目录
 * @returns {void}
 */
function removeMigrationDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

describe("版本化迁移执行器", () => {
  test("按文件名顺序执行未登记迁移并记录版本", async () => {
    const directory = createMigrationDirectory();
    fs.writeFileSync(path.join(directory, "202607300002_second.sql"), "SELECT 'second';");
    fs.writeFileSync(path.join(directory, "202607300001_first.sql"), "SELECT 'first';");
    const { client, calls } = createClient();

    try {
      const applied = await runMigrations(client, { migrationsDir: directory, logger: { info: jest.fn() } });

      expect(applied).toEqual([
        "202607300001_first.sql",
        "202607300002_second.sql"
      ]);
      expect(calls.filter((call) => call.text.startsWith("SELECT '")).map((call) => call.text)).toEqual([
        "SELECT 'first';",
        "SELECT 'second';"
      ]);
      expect(calls.filter((call) => call.text.startsWith("INSERT INTO schema_migrations"))).toHaveLength(2);
    } finally {
      removeMigrationDirectory(directory);
    }
  });

  test("已登记迁移的校验值不一致时拒绝继续执行", async () => {
    const directory = createMigrationDirectory();
    const name = "202607300001_create_table.sql";
    fs.writeFileSync(path.join(directory, name), "CREATE TABLE migration_example (id INT);");
    const { client, calls } = createClient({ appliedRows: [{ name, checksum: "a".repeat(64) }] });

    try {
      await expect(runMigrations(client, { migrationsDir: directory, logger: { info: jest.fn() } }))
        .rejects.toThrow(`已执行的迁移文件不能修改: ${name}`);
      expect(calls.map((call) => call.text)).not.toContain("BEGIN");
    } finally {
      removeMigrationDirectory(directory);
    }
  });

  test("迁移 SQL 失败时回滚且不登记版本", async () => {
    const directory = createMigrationDirectory();
    fs.writeFileSync(path.join(directory, "202607300001_broken.sql"), "BROKEN SQL;");
    const { client, calls } = createClient({ failSql: "BROKEN SQL" });

    try {
      await expect(runMigrations(client, { migrationsDir: directory, logger: { info: jest.fn() } }))
        .rejects.toThrow("迁移失败 202607300001_broken.sql: 数据库拒绝该 SQL");
      expect(calls.map((call) => call.text)).toContain("ROLLBACK");
      expect(calls.some((call) => call.text.startsWith("INSERT INTO schema_migrations"))).toBe(false);
    } finally {
      removeMigrationDirectory(directory);
    }
  });
});
