# refactor-income-statistics

## 目标

将收入统计页面使用的 `/api/revenue/*` 接口迁移到 `backend/modules/income-statistics/`，保持 API 路径、请求/响应格式、数据库 schema、收入口径和日期语义不变。

## 检查清单

- [x] 确认前端收入统计页调用的 API 边界
- [x] 创建 `income-statistics` 模块目录
- [x] 拆分 routes/controller/validator
- [x] 拆分 service
- [x] 拆分 repository，并迁移收入统计 SQL
- [x] 在 `backend/app.js` 注册新模块路由
- [x] 删除未使用的旧 `/api/revenue/receipts` 路由
- [x] 补充模块 README 和全局接口文档索引
- [x] 补充模块本地 controller/validator 测试
- [x] 运行聚焦测试并修复本次迁移造成的问题
- [x] 最终检查 diff，确认只改收入统计相关文件
