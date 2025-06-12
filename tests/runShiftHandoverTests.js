/**
 * 交接班功能测试运行器
 * 用于单独运行交接班相关的所有测试
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 开始运行交接班功能测试套件...\n');

const testFiles = [
  'tests/shiftHandover.test.js',
  'tests/shiftHandoverModule.test.js',
  'tests/shiftHandoverIntegration.test.js',
  'tests/shiftHandoverPerformance.test.js'
];

console.log('📋 将运行以下测试文件:');
testFiles.forEach((file, index) => {
  console.log(`   ${index + 1}. ${file}`);
});
console.log('');

// 设置Jest命令
const jestPath = path.resolve('./node_modules/.bin/jest');
const jestArgs = [
  ...testFiles,
  '--verbose',
  '--detectOpenHandles',
  '--forceExit',
  '--maxWorkers=1', // 单线程运行避免数据库冲突
  '--testTimeout=60000' // 60秒超时
];

// 运行Jest
const jest = spawn('node', [jestPath, ...jestArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ 所有交接班测试通过！');
  } else {
    console.log('\n❌ 部分测试失败，请检查错误信息');
  }
  process.exit(code);
});

jest.on('error', (error) => {
  console.error('❌ 测试运行器错误:', error);
  process.exit(1);
});
