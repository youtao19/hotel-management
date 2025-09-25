# 交接班路由测试使用指南

## 测试文件位置
`backend/tests/handoverRoute.test.js`

## 运行测试

### 运行单个测试文件
```bash
npm test -- --testPathPattern=handoverRoute.test.js
```

### 运行所有测试
```bash
npm test
```

### 静默模式运行（减少输出）
```bash
npm test -- --testPathPattern=handoverRoute.test.js --silent
```

## 测试覆盖内容

### GET 路由测试
- `/api/handover/table` - 获取交接班表格数据（计算版本）
- `/api/handover/handover-table` - 获取交接班表格数据（从handover表查询）
- `/api/handover/remarks` - 获取备忘录数据
- `/api/handover/special-stats` - 获取交接班特殊统计
- `/api/handover/dates` - 获取可访问日期列表
- `/api/handover/dates-flexible` - 获取可访问日期列表（宽松模式）
- `/api/handover/admin-memos` - 获取管理员备忘录

### POST 路由测试
- `/api/handover/start` - 开始交接班
- `/api/handover/save-amounts` - 保存页面数据
- `/api/handover/save-admin-memo` - 保存管理员备忘录

## 测试场景

每个路由都包含以下测试场景：

### 成功场景
- 正常请求和响应
- 数据格式验证
- 响应结构验证

### 错误场景
- 缺少必需参数（400错误）
- 无效数据格式（400错误）
- 业务逻辑错误（如数据已存在 - 409错误）
- 服务器内部错误（500错误）

## 技术实现

### Mock机制
- 使用 `jest.mock()` 模拟 `handoverModule` 模块
- 每个测试前都会重置所有mock函数
- 使用 `mockResolvedValue()` 和 `mockRejectedValue()` 模拟成功和失败场景

### 测试工具
- **supertest**: HTTP请求测试
- **jest**: 测试框架和断言
- **express**: 应用程序框架

### 数据库处理
- 使用全局清理函数 `global.cleanupTestData()` 清理测试数据
- Mock数据库模块，避免实际数据库操作影响测试

## 注意事项

1. 测试运行前会自动初始化测试环境
2. 每个测试用例都是独立的，不会相互影响
3. Mock函数确保测试不依赖真实的数据库或外部服务
4. 所有的console.log输出都是正常的路由日志，不影响测试结果

## 测试统计

- **总计测试用例**: 34个
- **GET路由测试**: 20个
- **POST路由测试**: 14个
- **覆盖率**: 100%的路由和主要业务逻辑