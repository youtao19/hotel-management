module.exports = {
  // Node 环境
  testEnvironment: "node",

  // 匹配你的测试文件
  testMatch: [
    "**/tests/**/*.test.js",
    "**/tests/**/*.integration.test.js",
    "**/__tests__/**/*.test.js"
  ],

  // 自动执行数据库初始化脚本
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // 避免 PG/Redis 多 worker 冲突
  maxWorkers: 1,

  // 清理 mocks
  clearMocks: true,
};
