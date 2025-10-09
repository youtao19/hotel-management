module.exports = {
  // 测试环境：Node.js
  testEnvironment: 'node',

  // 根目录：项目根目录
  rootDir: './',

  // 测试文件搜索范围：仅在 backend 中搜索
  roots: ['<rootDir>/backend'],

  // 测试文件匹配规则
  testMatch: [
    '<rootDir>/backend/tests/**/*.test.js',
    '<rootDir>/backend/tests/**/*.spec.js'
  ],

  // 全局测试设置文件
  setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.js'],

  // 串行执行测试（避免数据库并发问题）
  maxWorkers: 1,

  // 测试超时时间（30秒）
  testTimeout: 30000,

  // 不强制退出（setup.js 已正确关闭所有连接）
  forceExit: false,

  // 详细输出
  verbose: true,

  // 模块名称映射（用于 mock）
  moduleNameMapper: {
    '^nanoid$': '<rootDir>/backend/tests/__mocks__/nanoid.js'
  },

  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],

  // 覆盖率收集范围
  collectCoverageFrom: [
    'backend/modules/**/*.js',
    'backend/routes/**/*.js',
    '!backend/modules/**/index.js',
    '!backend/node_modules/**',
    '!backend/tests/**'
  ],

  // 覆盖率输出目录
  coverageDirectory: '<rootDir>/coverage',

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      lines: 60,
      statements: 60,
      functions: 55,
      branches: 50
    }
  },

  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/',
    '/backend/node_modules/',
    '\\.bak$',
    '\\.bak2$'
  ],

  // 转换配置（如果需要支持 ES modules）
  transform: {},

  // 清除模拟
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false
};
