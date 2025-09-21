module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./backend/tests/setup.js'],
  maxWorkers: 1,
  testTimeout: 30000,
  forceExit: true, // 如果 setup.js 已经关闭了数据库，可以改成 false
  collectCoverageFrom: [
    'modules/**/*.js',
    '!modules/**/index.js'
  ],
  coverageThreshold: {
    global: {
      lines: 60,
      statements: 60,
      functions: 55,
      branches: 50
    }
  }
};
