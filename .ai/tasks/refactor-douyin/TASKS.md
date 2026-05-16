# refactor-douyin

## 目标

将抖音直连、房型映射、价量 SPI、可订检查、ARI 通知和本地渠道映射统一纳入 `backend/modules/douyin`，保持 API 路径、请求/响应格式、数据库结构、事务行为和日期时间语义不变。

## 成功标准

- [x] `backend/modules/douyin` 成为抖音后端代码入口。
- [x] `ota_channel_mappings` 的抖音读写纳入 `backend/modules/douyin` 管理。
- [x] `backend/app.js` 挂载路径保持不变。
- [x] 聚焦抖音测试通过。
- [x] 模块 README 说明接口、边界和 `ota_channel_mappings` 当前归属。
- [x] 旧 `backend/modules/ota` 中不再保留未使用的抖音映射 repository。

## Phase 1：建立模块边界

- [x] 创建 `backend/modules/douyin` 模块目录。
- [x] 迁移抖音 routes 到模块目录。
- [x] 迁移抖音 services 到模块目录。
- [x] 更新 `backend/app.js` 和调用方 require 路径。
- [x] 更新测试 mock 和 route 引用路径。

## Phase 2：纳入渠道映射表

- [x] 创建 `rate-plan/channelMapping.repository.js`。
- [x] 将 `ota_channel_mappings` 的抖音写入改为 repository。
- [x] 删除旧 `backend/modules/ota/repositories/channelMapping.repository.js`。

## Phase 3：文档和验证

- [x] 创建 `backend/modules/douyin/README.md`。
- [x] 运行抖音聚焦测试。
- [x] 修复本次迁移引入的问题。

## 后续可选深化

- [x] 将 `room-type-mapping/roomTypeMapping.routes.js` 继续拆成 controller / validator / service / repository。
- [x] 将价量 SPI 和可订检查中的复用查询继续收口到 repository。
- [x] 将 ARI 通知中的套餐映射查询收口到 repository。
- [x] 将抖音商品同步中的套餐读取和物理房型缓存更新收口到 repository。
- [x] 按功能子目录整理 `backend/modules/douyin`。
- [x] 将原 `backend/services` 中的抖音物理房型查询和手动脚本迁入抖音模块。
- [x] 清空旧 `backend/services` 目录并确认无旧路径引用。
- [x] 将 `/api/rate-plans` 路由入口从 `backend/routes` 迁入 `backend/modules/douyin/rate-plan`。
