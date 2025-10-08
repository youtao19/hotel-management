module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./backend/tests/setup.js'],
  maxWorkers: 1,
  testTimeout: 30000,
  forceExit: false, // setup.js 已经正确关闭了所有连接
  moduleNameMapper: {
    '^nanoid$': '<rootDir>/backend/tests/__mocks__/nanoid.js'
  },
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
