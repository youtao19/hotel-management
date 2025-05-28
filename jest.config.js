module.exports = {
  testEnvironment: 'node', // 因为你是测试 Node.js 接口
  setupFilesAfterEnv: ['./tests/setup.js'], // 在测试前运行初始化逻辑
  testMatch: ['**/tests/**/*.test.js'], // 匹配你已有的测试文件路径
};
