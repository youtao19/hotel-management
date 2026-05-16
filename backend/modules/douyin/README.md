# douyin

## 模块职责

本模块服务抖音直连相关能力，负责抖音房型映射、预售券商品同步、价量 SPI、可订检查、Webhook 回调、ARI 通知和本地回调日志。

## API 接口

- `GET /api/douyin/room-type-mapping`
- `POST /api/douyin/room-type-mapping/refresh`
- `POST /api/douyin/room-type-mapping`
- `DELETE /api/douyin/room-type-mapping/:localRoomType`
- `GET /api/rate-plans`
- `GET /api/rate-plans/:id`
- `POST /api/rate-plans`
- `PATCH /api/rate-plans/:id`
- `DELETE /api/rate-plans/:id`
- `POST /api/rate-plans/:id/douyin/sync`
- `POST /api/douyin/ari-notify`
- `POST /douyin/webhooks`
- `POST /douyin/spi/price-volume`
- `POST /douyin/spi/bookable`

## 当前阶段

Phase 6: 抖音相关 routes、services 和原 `backend/services` 中的物理房型查询脚本依赖能力已迁入 `backend/modules/douyin`，并按 external、room-type-mapping、rate-plan、physical-room、token 分目录整理。

## 目录结构

- `external/`：抖音 Webhook、SPI 入口、签名校验和回调日志。
- `room-type-mapping/`：前端“抖音房型匹配”页面使用的房型映射接口。
- `rate-plan/`：本地售卖套餐接口、抖音预售券商品同步、价量 SPI、可订检查、ARI 通知和渠道映射。
- `physical-room/`：抖音物理房型查询、本地缓存刷新和房型相关手动脚本依赖能力。
- `token/`：抖音 OpenAPI client token 获取和缓存。

## 业务边界

- 抖音物理房型缓存和本地房型绑定归本模块。
- 本地售卖套餐同步成抖音预售券商品归本模块。
- 抖音回调、SPI 和手动 ARI 通知归本模块。
- 本地售卖套餐基础 CRUD 路径仍是 `/api/rate-plans`，入口已迁入 `rate-plan/ratePlan.routes.js`。
- 房间、房型基础资料维护归 `room-manage`。
- 房态和库存占用规则仍由订单、房态和价量查询相关服务共同维护。

## `ota_channel_mappings` 归属

`ota_channel_mappings` 当前用于保存本地 `rate_plans` 与抖音 `rate_plan_id` 的映射。

数据库层没有外键约束，业务上按以下字段关联：

- `local_target_type = 'RATE_PLAN'`
- `local_target_id = rate_plans.id`
- `channel_code = 'DOUYIN'`
- `channel_item_id = 抖音 rate_plan_id`

本模块通过 `rate-plan/channelMapping.repository.js` 写入该表；价量 SPI、可订检查和 ARI 通知通过 `rate-plan/ratePlan.repository.js` 读取该表。后续如果接入多个 OTA 渠道，再考虑抽出公共 OTA 基础模块。

## 注意事项

- API 路径不能改，抖音侧回调路径依赖当前地址。
- 请求和响应格式不能改，避免影响前端和抖音验收。
- 不调整数据库结构。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不当作 UTC 时间转换。
- `timestamptz` 字段不手动加减时区。
