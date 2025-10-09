# Jest 测试配置说明

## 配置概览

项目已重新配置 Jest 测试框架，适配 monorepo（npm workspaces）项目结构。

## 主要配置项

### 1. 测试文件位置
- **测试根目录**: `backend/`
- **测试文件匹配规则**: 
  - `backend/tests/**/*.test.js`
  - `backend/tests/**/*.spec.js`

### 2. 执行设置
- **测试环境**: Node.js
- **并发配置**: 串行执行（maxWorkers: 1）避免数据库并发问题
- **超时时间**: 30秒
- **详细输出**: 开启（verbose: true）

### 3. 数据库配置
- **全局设置文件**: `backend/tests/setup.js`
- **自动初始化**: PostgreSQL + Redis
- **自动清理**: 测试完成后自动清理数据和关闭连接

### 4. 覆盖率配置
- **收集范围**: 
  - `backend/modules/**/*.js`
  - `backend/routes/**/*.js`
- **排除文件**:
  - `backend/modules/**/index.js`
  - `backend/node_modules/**`
  - `backend/tests/**`
- **输出目录**: `coverage/`
- **报告格式**: text, lcov, html, json-summary
- **覆盖率阈值**:
  - 代码行: 60%
  - 语句: 60%
  - 函数: 55%
  - 分支: 50%

### 5. Mock 配置
- **nanoid**: 已配置 mock，位于 `backend/tests/__mocks__/nanoid.js`

### 6. 忽略文件
- 前端目录（`frontend/`）
- 备份文件（`.bak`, `.bak2`）
- node_modules

## 使用方法

### 运行所有测试
```bash
npm test
```

### 监视模式
```bash
npm run test:watch
```

### 运行特定测试文件
```bash
npm test -- backend/tests/orderCreate.test.js
```

### 运行测试并生成覆盖率报告
```bash
npm test -- --coverage
```

### 列出所有测试文件
```bash
npm test -- --listTests
```

### 运行特定测试套件
```bash
# 运行包含 "order" 的测试
npm test -- --testNamePattern="order"

# 运行特定文件夹的测试
npm test -- backend/tests/integration/
```

## 测试文件结构

```
backend/tests/
├── setup.js                          # 全局测试设置
├── test-helpers.js                   # 测试辅助函数
├── __mocks__/                        # Mock 文件
│   └── nanoid.js
├── api/                              # API 测试
│   └── authRoute.test.js
├── integration/                      # 集成测试
│   ├── orderBillFlow.test.js
│   └── refundDepositExtended.test.js
├── unit/                             # 单元测试
│   └── orderHelpers.spec.js
└── *.test.js                         # 其他测试文件
```

## 注意事项

1. **数据库连接**: 测试使用本地 PostgreSQL，确保数据库已启动
2. **Redis 连接**: 需要 Redis 服务运行（默认 localhost:6379）
3. **环境变量**: 测试环境变量在 `setup.js` 中设置，无需额外配置
4. **测试隔离**: 每个测试文件可使用 `global.cleanupTestData()` 清理数据
5. **串行执行**: 为避免数据库并发问题，测试串行执行（可能较慢）

## 常见问题

### 测试超时
如果测试超时，可以在测试文件中单独设置：
```javascript
jest.setTimeout(60000); // 60秒
```

### 数据库连接问题
确保 `dev.env` 文件中的数据库配置正确：
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=peach
DB_PASSWORD=1219
```

### 清理测试数据
在每个测试的 `afterEach` 或 `afterAll` 中调用：
```javascript
afterEach(async () => {
  await global.cleanupTestData();
});
```

## 配置文件位置

- **Jest 配置**: `jest.config.js`（根目录）
- **测试设置**: `backend/tests/setup.js`
- **测试脚本**: `package.json` 中的 `scripts` 部分

## 更新日志

- **2025-10-09**: 重新配置 Jest 适配 monorepo 结构
  - 添加 `roots` 和 `testMatch` 配置
  - 修复 `collectCoverageFrom` 路径
  - 添加 `testPathIgnorePatterns`
  - 优化覆盖率报告配置
  - 更新 `.gitignore` 排除覆盖率报告

