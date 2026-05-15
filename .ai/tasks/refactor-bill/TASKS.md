# refactor-bill

## 目标

把账单相关路由、业务流程、数据库访问和自动账单任务迁入 `backend/modules/bill/`，保持公开 API 路径、请求/响应格式、数据库 schema、事务行为和日期时间语义不变。完成后旧文件 `backend/routes/billRoute.js`、`backend/modules/billModule.js`、`backend/modules/autoBillService.js` 可以删除。

## Checklist

- [x] 创建任务状态文件。
- [x] 读取账单路由、旧账单模块、自动账单任务、前端 API 调用和聚焦测试。
- [x] 创建 `bill` 模块的 routes/controller/validator/service/repository/README。
- [x] 把 `/api/bills` 现有接口迁入 `bill` 模块。
- [x] 把自动账单任务迁入 `bill` 模块。
- [x] 替换跨模块 `billModule` / `autoBillService` 引用。
- [x] 删除旧 `billRoute.js`、`billModule.js`、`autoBillService.js`。
- [x] 更新接口文档。
- [x] 运行聚焦测试和引用检查。
