# 交接班功能测试指南

## 📋 测试概述

本项目为交接班功能提供了完整的测试套件，包括单元测试、集成测试、API测试和性能测试。

## 🧪 测试文件结构

```
tests/
├── shiftHandover.test.js              # API接口测试
├── shiftHandoverModule.test.js        # 业务模块单元测试  
├── shiftHandoverIntegration.test.js   # 集成测试
├── shiftHandoverPerformance.test.js   # 性能测试
└── runShiftHandoverTests.js           # 测试运行器
```

## 🚀 运行测试

### 运行所有交接班测试
```bash
npm run test:shift-handover
```

### 运行单独的测试类型

#### 1. 单元测试（业务逻辑）
```bash
npm run test:shift-handover-unit
```
测试内容：
- 数据获取函数
- 统计计算逻辑
- Excel生成功能
- 数据验证逻辑

#### 2. API接口测试
```bash
npm run test:shift-handover-api
```
测试内容：
- GET /api/shift-handover/receipts
- GET /api/shift-handover/statistics
- POST /api/shift-handover/save
- GET /api/shift-handover/history
- POST /api/shift-handover/export

#### 3. 集成测试
```bash
npm run test:shift-handover-integration
```
测试内容：
- 完整的交接班流程
- 数据一致性验证
- 并发操作测试
- 错误处理测试

#### 4. 性能测试
```bash
npm run test:shift-handover-performance
```
测试内容：
- 大数据量处理性能
- 并发请求处理能力
- 内存使用优化
- 响应时间基准测试

## 📊 测试覆盖范围

### API端点测试
- ✅ 获取收款明细（客房/休息房）
- ✅ 获取统计数据  
- ✅ 保存交接班记录
- ✅ 获取历史记录
- ✅ 导出Excel文件

### 业务逻辑测试
- ✅ 数据计算准确性
- ✅ 支付方式统计
- ✅ 房间类型分类
- ✅ 时间范围筛选
- ✅ 数据格式转换

### 数据一致性测试
- ✅ 明细数据与统计数据一致性
- ✅ 收入计算正确性
- ✅ 房间数量统计准确性
- ✅ 交接款计算逻辑

### 性能测试指标
- ✅ 1000条记录查询 < 1秒
- ✅ 统计计算 < 500ms
- ✅ Excel生成 < 3秒
- ✅ 50个并发请求 < 5秒
- ✅ 内存增长 < 100MB

## 🛠️ 测试环境配置

### 数据库要求
- PostgreSQL数据库连接正常
- 测试数据自动清理
- 事务隔离保证

### 测试数据
- 自动生成测试订单
- 支持多种支付方式
- 覆盖客房和休息房类型
- 包含历史记录数据

## 📈 测试报告

运行测试后会生成详细的测试报告，包括：

### 功能测试结果
- 通过/失败的测试用例数量
- 代码覆盖率统计
- 错误详情和堆栈跟踪

### 性能测试结果
- API响应时间统计
- 内存使用情况
- 并发处理能力
- 数据处理性能

## 🔧 测试配置

### Jest配置
```javascript
{
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60000
}
```

### 环境变量
```bash
NODE_ENV=test
```

## 🐛 调试测试

### 运行单个测试文件
```bash
npx jest tests/shiftHandover.test.js --verbose
```

### 监听模式运行
```bash
npm run test:watch
```

### 调试模式
```bash
npx jest --inspect-brk tests/shiftHandover.test.js
```

## 📝 测试最佳实践

### 1. 数据隔离
- 每个测试使用独立的测试数据
- 测试前后自动清理数据
- 使用事务回滚机制

### 2. 性能基准
- 设置合理的性能期望
- 监控内存使用情况
- 测试并发处理能力

### 3. 错误覆盖
- 测试各种错误场景
- 验证错误处理逻辑
- 确保优雅失败

### 4. 持续集成
- 自动化测试执行
- 测试结果通知
- 性能回归检测

## 🚨 注意事项

1. **数据库状态**：运行测试前确保数据库服务正常
2. **端口冲突**：确保测试环境端口（3000）未被占用  
3. **内存限制**：性能测试可能需要较大内存
4. **超时设置**：某些测试需要较长执行时间
5. **并发限制**：避免与生产环境数据冲突

## 📞 支持

如果遇到测试问题，请检查：
1. 数据库连接配置
2. 依赖包完整性
3. 环境变量设置
4. 端口占用情况

更多信息请参考项目文档或联系开发团队。
