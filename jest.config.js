module.exports = {
  testEnvironment: 'node', // 因为你是测试 Node.js 接口
  setupFilesAfterEnv: ['./tests/setup.js'], // 在测试前运行初始化逻辑
  testMatch: ['**/tests/**/*.test.js'], // 匹配你已有的测试文件路径
  maxWorkers: 1, // 串行运行测试，避免数据库并发冲突
  testTimeout: 30000, // 增加测试超时时间到30秒
  forceExit: true, // 强制退出，避免挂起
};
