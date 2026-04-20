# OTA 接口文档

> 抖音直连后端路由 `/api/douyin/*` 已停用，原 `backend/routes/douyin/douyinApi.js` 已删除。
> 本文中抖音相关章节仅作为历史联调资料保留；当前可用的本地套餐管理接口是 `/api/rate-plans`。

## 1. 文档范围
本文档覆盖 OTA 一期入站接口：
- `POST /api/ota/v1/orders`
- `GET /api/ota/v1/inventory`
- `PUT /api/ota/v1/inventory`

首期渠道固定为 `meituan`，只支持“推送新订单 + 查询/设置库存配额”。

## 2. 鉴权约定
- 所有请求都必须带以下请求头：
  - `x-ota-channel`: 固定 `meituan`
  - `x-ota-key`: 渠道访问 key
  - `x-ota-timestamp`: Unix 时间戳，默认允许偏差 `300` 秒
  - `x-ota-nonce`: 单次请求唯一随机串，默认 `600` 秒内不可重复
  - `x-ota-signature`: `HMAC-SHA256` 签名，hex 小写
- 签名基串：

```text
METHOD
PATH
TIMESTAMP
NONCE
SHA256(rawBody)
```

- `PATH` 不包含 query string。例如库存查询固定使用 `/api/ota/v1/inventory`。
- 空请求体按空字符串计算 `SHA256`。

## 3. 通用状态码
- `200` 成功
- `201` 创建成功
- `400` 参数错误
- `401` 鉴权失败 / 时间戳超窗 / nonce 重放
- `403` OTA 通道未启用或配置错误
- `409` 库存冲突，无法创建订单
- `500` 服务端异常

## 4. 新建 OTA 订单

### 4.1 请求
- Method: `POST`
- Path: `/api/ota/v1/orders`
- 说明：
  - 幂等键为 `order_source + id_source`，其中 `order_source=meituan`，`id_source=externalOrderId`
  - 订单默认创建为 `pending`
  - 房间号由后端自动分配，同房型内按 `room_number` 升序选择首个可用房
  - 若只传总价，后端会按现有订单口径自动分摊每日房价

请求体示例：

```json
{
  "externalOrderId": "MT202603060001",
  "guestName": "张三",
  "phone": "13800138000",
  "roomType": "asu_xiao_zhu",
  "checkInDate": "2026-03-10",
  "checkOutDate": "2026-03-12",
  "totalPrice": 520,
  "paymentMethod": "平台",
  "remarks": "OTA 推单"
}
```

也支持直接传每日价：

```json
{
  "externalOrderId": "MT202603060002",
  "guestName": "李四",
  "roomType": "bo_ye_shuang",
  "checkInDate": "2026-03-10",
  "checkOutDate": "2026-03-12",
  "dailyPrices": {
    "2026-03-10": 260,
    "2026-03-11": 280
  }
}
```

### 4.2 成功响应
首次创建：

```json
{
  "success": true,
  "existing": false,
  "data": {
    "order": [
      {
        "order_id": "OTA-MEITUAN-1741276800000-abc123",
        "order_source": "meituan",
        "id_source": "MT202603060001",
        "room_number": "102",
        "status": "pending"
      }
    ]
  }
}
```

重复推送：

```json
{
  "success": true,
  "existing": true,
  "data": {
    "order": [
      {
        "order_id": "OTA-MEITUAN-1741276800000-abc123",
        "order_source": "meituan",
        "id_source": "MT202603060001"
      }
    ]
  }
}
```

### 4.3 典型错误
- `401 OTA_SIGNATURE_INVALID`: 请求签名不正确
- `401 OTA_TIMESTAMP_EXPIRED`: 时间戳超窗
- `401 OTA_NONCE_REPLAYED`: nonce 重放
- `409 OTA_INVENTORY_CONFLICT`: 指定日期库存不足
- `409 OTA_ROOM_NOT_AVAILABLE`: 实际无房可分配

## 5. 查询库存

### 5.1 请求
- Method: `GET`
- Path: `/api/ota/v1/inventory`
- Query:
  - `startDate`: `YYYY-MM-DD`
  - `endDate`: `YYYY-MM-DD`
  - `roomType`: 可选，房型编码

示例：

```text
GET /api/ota/v1/inventory?startDate=2026-03-10&endDate=2026-03-12&roomType=asu_xiao_zhu
```

### 5.2 返回字段
- `total_rooms`: 当前房型可参与售卖的物理房间数（排除关闭/维修）
- `physical_available`: 物理可售数 = 物理房量 - 活跃订单占用
- `quota_limit`: OTA 配额上限，未设置时为 `null`
- `sellable_available`: 最终可售数 = `max(0, min(physical_available, quota_limit_or_physical))`

成功响应示例：

```json
{
  "success": true,
  "data": [
    {
      "stay_date": "2026-03-10",
      "room_type": "asu_xiao_zhu",
      "total_rooms": 8,
      "physical_available": 7,
      "quota_limit": 3,
      "sellable_available": 3
    }
  ]
}
```

## 6. 写入库存配额

### 6.1 请求
- Method: `PUT`
- Path: `/api/ota/v1/inventory`
- 说明：
  - 采用绝对值覆盖语义
  - `quota=null` 代表删除该日期该房型的 OTA 配额限制

请求体示例：

```json
{
  "updatedBy": "ota-sync-job",
  "entries": [
    {
      "roomType": "asu_xiao_zhu",
      "stayDate": "2026-03-10",
      "quota": 3
    },
    {
      "roomType": "asu_xiao_zhu",
      "stayDate": "2026-03-11",
      "quota": null
    }
  ]
}
```

### 6.2 成功响应

```json
{
  "success": true,
  "data": [
    {
      "stay_date": "2026-03-10",
      "room_type": "asu_xiao_zhu",
      "total_rooms": 8,
      "physical_available": 7,
      "quota_limit": 3,
      "sellable_available": 3
    },
    {
      "stay_date": "2026-03-11",
      "room_type": "asu_xiao_zhu",
      "total_rooms": 8,
      "physical_available": 7,
      "quota_limit": null,
      "sellable_available": 7
    }
  ]
}
```

## 7. 环境变量
- `OTA_API_ENABLED`: 是否启用 OTA API
- `OTA_MEITUAN_KEY`: 美团渠道 key
- `OTA_MEITUAN_SECRET`: 美团渠道 secret
- `OTA_SIGN_SKEW_SECONDS`: 时间戳允许偏差秒数
- `OTA_NONCE_TTL_SECONDS`: nonce 防重放缓存秒数

## 8. 抖音回调文档
> 历史资料：当前系统不再注册 `/api/douyin/*` 路由，下列接口不可用。

- 抖音回调联调、幂等规则与成功响应说明已单独整理，请查看 [抖音回调联调文档](/Users/peach/develop/hotel-management/docs/抖音回调联调文档.md)。
- 当前已支持抖音创建订单回调与取消订单回调两条联调链路：
  - `POST /api/douyin/callback/spi`
  - `POST /api/douyin/callback/presale`
  - `POST /api/douyin/callback/bookable`
  - `POST /api/douyin/callback/spi/mock`
  - `POST /api/douyin/callback/presale/mock`
  - `POST /api/douyin/callback/bookable/mock`
  - `POST /api/douyin/callback/cancel`
  - `POST /api/douyin/callback/cancel/mock`
- 当取消通知带 `need_audit=true` 时，系统会自动调用抖音“售后审核结果返回”接口回传同意/拒绝结果。
- 抖音模块内部已统一错误码与状态枚举，联调时请以 [抖音回调联调文档](/Users/peach/develop/hotel-management/docs/抖音回调联调文档.md) 中的“错误码与状态枚举”章节为准。
- 住宿预售券场景已新增独立创单回调：
  - `action:hotel_spot.order.create_presale_order` -> `POST /api/douyin/callback/presale`
- 住宿预售券场景已新增可订检查回调：
  - `可订检查 SPI` -> `POST /api/douyin/callback/bookable`
- 酒店静态信息处理结果已新增回调入口：
  - `酒店静态信息处理结果推送Webhook` -> `POST /api/douyin/callback/hotel-info`
  - 本地免签联调入口：`POST /api/douyin/callback/hotel-info/mock`
- 当前酒店静态信息主链路采用模式二（自助匹配），官方文档：
  - `自助匹配酒店信息查询接口` -> `https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-info-fetch/hotel-info-query`
- 创单失败场景现在会尽量把失败信息落到 `douyin_orders`，便于联调排查：
  - `booking_stage`
  - `booking_error_code`
  - `booking_error_description`
  - `booking_failure_response`
- 已补充新的抖音官方文档索引，包含“创建/更新预定商品”“创建/更新预售券”“预售券审核结果通知”“价量态拉取接口”。
- 当前仓库在酒店静态信息侧已切换模式二主链路：支持主动查询/批量同步酒店静态信息，并支持房型映射管理；Webhook 作为补充能力保留。
- 最新抖音文档索引请查看 [抖音官方api接口地址](/Users/peach/develop/hotel-management/docs/抖音官方api接口地址.md)。
- 当前还提供一个手动确认接单结果接口，便于验收阶段回传接单或拒单：
  - `POST /api/douyin/order/confirm`
  - 请求体支持 `otaOrderId`、`confirmResult`、`confirmNumber`、`rejectCode`、`rejectReason`
  - 当 `confirmResult=1` 表示接单；当 `confirmResult=2` 表示拒单
  - 若订单在创单时已按同步接单返回 `confirm_mode=1`，则不允许再次调用该接口做异步确认
- 当前还提供一组价量态调试接口，便于验收阶段手动预览和推送：
  - `POST /api/douyin/ari/preview`
  - `POST /api/douyin/ari/stock/push`
  - `POST /api/douyin/ari/price/push`
  - `POST /api/douyin/ari/notify`
  - 请求体统一支持 `ratePlanIds`、`startDate`、`endDate`
- 当前还提供一组主动拉取价量态回调入口：
  - `POST /api/douyin/callback/ari-pull`
  - `POST /api/douyin/callback/ari-pull/mock`
  - 当前返回 `data.error_code`、`data.description`、`data.stock_and_amount`
  - 当前基础口径复用本地 ARI 组装能力，按 `rate_plan_id + 日期范围` 返回价格、房量、房态
- 当前还提供退款结果通知回调入口：
  - `POST /api/douyin/callback/refund-result`
  - `POST /api/douyin/callback/refund-result/mock`
  - 当前用于承接抖音退款结果通知，并把结果回写到 `douyin_orders`
- 当前还提供退款逆向 case 回调入口：
  - `POST /api/douyin/callback/refund-case`
  - `POST /api/douyin/callback/refund-case/mock`
  - 当前用于承接“客服强退 / 协商退款 / 日历房退款 case”基础闭环，并回写退款 case 状态与建议退款金额
- 当前还提供酒店静态信息处理结果回调入口：
  - `POST /api/douyin/callback/hotel-info`
  - `POST /api/douyin/callback/hotel-info/mock`
  - 当前用于补充接收异步结果并回执 success（模式二主链路不依赖该回调）
- 当前还提供一组酒店静态信息自助匹配接口（模式二主链路）：
  - `POST /api/douyin/hotel-info/query`
  - `POST /api/douyin/hotel-info/sync`
  - 请求体支持 `accountId`，并支持分页参数：
    - `hotel-info/query`：`pageIndex`、`pageSize`
    - `hotel-info/sync`：`startPageIndex`、`pageSize`、`maxPages`
- 当前还提供一组抖音房型映射管理接口（服务端落库到 `douyin_room_type_mapping`）：
  - `GET /api/douyin/room-type-mapping`
  - `POST /api/douyin/room-type-mapping`
  - 映射口径固定为一对一：一个本地房型只能绑定一个抖音物理房型，一个抖音物理房型也只能绑定一个本地房型
  - `POST` 请求体字段：
    - `mappings`：支持数组或对象格式，最终统一为 `douyinRoomId + douyinRoomName + localRoomType`
- 当前还提供一个“未支付超时取消”的手动调试接口：
  - `POST /api/douyin/order/timeout-cancel`
  - 请求体支持 `otaOrderId`，可选 `reason`
  - 当前会把 `douyin_orders.cancel_status` 更新为 `timeout_cancelled`
- 当前还提供一个手动物理房型创建接口，便于验收阶段先把本地房型推到抖音侧：
  - `POST /api/douyin/physical-room/create`
  - 请求体支持 `localRoomType`、`poiId`、`categoryId`、`images`，可选 `accountId`
  - 当未传 `accountId` 时，后端会回退使用环境变量 `DOUYIN_ACCOUNT_ID`
- 当前还提供一个手动物理房型上下架接口：
  - `POST /api/douyin/physical-room/status`
  - 请求体支持 `roomId`、`active`，可选 `accountId`
  - `active=true` 表示上架；`active=false` 表示下架
  - 当前通过 `physical_room/save` 做基础版状态更新，并同步回写本地 `raw_payload.active`
- 当前还提供一个手动创建日历房商品接口，便于验收阶段先把基础商品建到抖音侧：
  - `POST /api/douyin/rate-plan/create`
  - 请求体支持 `localRoomType`、`poiId`、`roomId`，可选 `accountId`、`mode`、`modeConfig`
  - `mode` 当前支持 `meal`、`cancel`、`stay`、`booking`
  - 当前已补第一阶段复杂规则字段：
    - `meal` 支持 `modeConfig.mealCount`
    - `cancel` 支持 `modeConfig.freeCancelHoursBeforeCheckIn`
    - `stay` 支持 `modeConfig.minStayNights`、`modeConfig.maxStayNights`
    - `booking` 支持 `modeConfig.advanceBookingDaysMin`、`modeConfig.advanceBookingDaysMax`
- 当前还提供一个按本地套餐同步抖音商品的接口：
  - `GET /api/douyin/rate-plans`
  - `POST /api/douyin/rate-plan/sync`
  - `GET` 用于读取本地套餐、抖音房型绑定、抖音套餐同步状态和本地数据异常事实
  - 请求体支持 `localRatePlanId`，可选 `accountId`、`poiId`、`mode`、`modeConfig`
  - 当前会从 `rate_plans -> rooms -> room_types -> douyin_room_type_mapping -> douyin_physical_rooms` 查询本地套餐与抖音物理房型绑定关系
  - `out_rate_plan_id` 使用本地 `rate_plans.id` 字符串，方便抖音侧回查本地套餐
  - 同步成功后会同时回写：
    - `douyin_physical_rooms.rate_plan_list`，兼容现有上下架与价量态链路
    - `ota_channel_mappings`，作为后续多渠道直连共用映射表
- 当前还提供一个手动更新日历房商品上下架状态接口：
  - `POST /api/douyin/rate-plan/status`
  - 请求体支持 `roomId`、`ratePlanId`、`active`，可选 `accountId`
  - `active=true` 表示上架；`active=false` 表示下架
  - 当前通过 `rateplan/save` 做基础版状态更新，并同步回写本地 `rate_plan_list.active`
- 当前还提供一组履约同步调试接口，便于验收阶段手动推送入住和离店：
  - `POST /api/douyin/order/check-in`
  - `POST /api/douyin/order/check-out`
  - 请求体统一支持 `orderId`
  - 当前真实业务动作也已接入自动触发：
    - 本地办理入住成功后，会自动尝试同步抖音入住状态
    - 本地办理退房成功后，会自动尝试同步抖音离店状态

## 9. 插件接单接口（动态签名）

### 9.1 请求
- Method: `POST`
- Path: `/api/plugin/orders`
- 鉴权请求头：
  - `x-plugin-key`: 插件调用方标识
  - `x-plugin-timestamp`: 时间戳（10位秒 / 13位毫秒）
  - `x-plugin-nonce`: 单次请求随机串（8~128位）
  - `x-plugin-signature`: HMAC-SHA256 签名（hex 小写）

签名基串：

```text
METHOD
PATH
TIMESTAMP
NONCE
SHA256(rawBody)
```

说明：
- `METHOD`：大写 HTTP 方法，例如 `POST`
- `PATH`：不含 query 的路径，例如 `/api/plugin/orders`
- `rawBody`：原始请求体字符串（服务端按原始报文参与验签）

签名计算：

```text
signature = HMAC_SHA256(PLUGIN_API_SECRET, signPayload)
```

### 9.2 典型鉴权错误码
- `PLUGIN_AUTH_NOT_CONFIGURED`：服务端未配置 key/secret
- `PLUGIN_AUTH_MISSING_HEADERS`：缺少签名请求头
- `PLUGIN_AUTH_INVALID_KEY`：`x-plugin-key` 不匹配
- `PLUGIN_AUTH_INVALID_TIMESTAMP`：时间戳格式错误
- `PLUGIN_AUTH_TIMESTAMP_EXPIRED`：时间戳超窗
- `PLUGIN_AUTH_INVALID_NONCE`：nonce 长度不合法
- `PLUGIN_AUTH_NONCE_REPLAYED`：nonce 重放
- `PLUGIN_AUTH_INVALID_SIGNATURE`：签名不匹配

### 9.3 关系表快照落库字段
- `platform` <- `platform`
- `ota_order_id` <- `otaOrderId`
- `local_order_id` <- 本地创建的 `orderId`
- `ota_room_type` <- `roomType`
- `ota_guest_name` <- `guestName`
- `ota_check_in_date` <- `checkInDate`
- `ota_check_out_date` <- `checkOutDate`
- `ota_total_price` <- `totalPrice`（缺失时回退 `roomPrice` 汇总）
- `ota_order_status` <- `otaOrderStatus`
- `latest_payload` <- 请求快照（含签名上下文，不含 secret）

### 9.4 创建处理规则
- 服务端创建插件订单时，会先按 `(platform, otaOrderId)` 检查 `ota_order_relation`
- 如果该 OTA 订单已经存在，则直接返回 `PLUGIN_ORDER_ALREADY_EXISTS`
- 重复订单判断优先级高于房型校验和排房逻辑，避免“已创建订单再次推送”被误判为“无可用房间”
- 仅当 OTA 订单不存在时，服务端才继续执行房型校验、排房和创建订单

重复创建响应示例：

```json
{
  "success": false,
  "code": "PLUGIN_ORDER_ALREADY_EXISTS",
  "message": "插件订单已存在"
}
```

### 9.5 插件鉴权环境变量
- `PLUGIN_API_KEY`: 插件调用方标识
- `PLUGIN_API_SECRET`: 插件签名密钥
- `PLUGIN_SIGN_SKEW_SECONDS`: 时间戳允许偏差秒数（默认 `300`）
- `PLUGIN_NONCE_TTL_SECONDS`: nonce 防重放缓存秒数（默认 `600`）

## 10. 插件房型映射接口

### 10.1 鉴权方式
房型映射接口当前使用 Bearer Token 鉴权，请求头如下：

```http
Authorization: Bearer <PLUGIN_API_TOKEN>
```

环境变量：
- `PLUGIN_API_TOKEN`: 插件调用接口的访问令牌

鉴权失败时的典型响应：
- 未配置 `PLUGIN_API_TOKEN`：`500`
- 缺少 `Authorization` 请求头：`401`
- `Authorization` 格式错误：`401`
- Token 无效：`401`

### 9.2 查询房型映射列表

- Method: `GET`
- Path: `/api/plugin/room-type-mapping`

#### 查询参数
- `platform`: 可选，平台标识，例如 `meituan`

#### 请求示例

```bash
curl -X GET 'http://localhost:3000/api/plugin/room-type-mapping?platform=meituan' \
  -H 'Authorization: Bearer <PLUGIN_API_TOKEN>'
```

#### 成功响应示例

```json
{
  "success": true,
  "code": "PLUGIN_ROOM_TYPE_MAPPING_LIST",
  "data": [
    {
      "id": 1,
      "platform": "meituan",
      "ota_room_type": "畅想影音 云端全景大床房",
      "local_room_type": "asu_xiao_zhu",
      "local_room_type_name": "阿苏晓筑",
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:00:00+08"
    },
    {
      "id": 2,
      "platform": "meituan",
      "ota_room_type": "行云阁 大床房",
      "local_room_type": "xing_yun_ge",
      "local_room_type_name": "行云阁",
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:00:00+08"
    }
  ],
  "message": "插件房型映射列表获取成功"
}
```

### 9.3 批量保存房型映射

- Method: `POST`
- Path: `/api/plugin/room-type-mapping`

#### 请求体字段
- `platform`: 必填，平台标识
- `mappings`: 必填，对象类型，key 为 OTA 房型名称，value 为本地房型映射信息

`mappings` 结构说明：
- 对象 key：OTA 房型名称
- `value`: 本地房型编码，对应 `room_types.type_code`
- `label`: 本地房型名称，可选字段，仅用于插件侧展示，服务端不落库

#### 请求示例

```json
{
  "platform": "meituan",
  "mappings": {
    "畅想影音 云端全景大床房": {
      "value": "asu_xiao_zhu",
      "label": "阿蘇小筑"
    },
    "行云阁 大床房": {
      "value": "xing_yun_ge",
      "label": "行云阁"
    }
  }
}
```

#### 处理规则
- 服务端会将 `mappings` 展开为多条映射记录批量处理
- 以 `(platform, ota_room_type)` 作为唯一键
- 已存在则更新 `local_room_type` 和 `updated_at`
- 不存在则新增

#### 成功响应示例

```json
{
  "success": true,
  "code": "PLUGIN_ROOM_TYPE_MAPPING_SAVED",
  "data": [
    {
      "id": 1,
      "platform": "meituan",
      "ota_room_type": "畅想影音 云端全景大床房",
      "local_room_type": "asu_xiao_zhu",
      "local_room_type_name": "阿苏晓筑",
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:05:00+08"
    },
    {
      "id": 2,
      "platform": "meituan",
      "ota_room_type": "行云阁 大床房",
      "local_room_type": "xing_yun_ge",
      "local_room_type_name": "行云阁",
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:05:00+08"
    }
  ],
  "message": "插件房型映射保存成功"
}
```

#### 典型错误响应
- `platform` 缺失：`400`
- `mappings` 不是对象：`400`
- `mappings` 为空对象：`400`
- 某个房型缺少 `value`：`400`

### 9.4 数据库存储说明
房型映射保存到表 `plugin_room_type_mapping`，字段含义如下：

- `id`: 主键 ID
- `platform`: 平台标识
- `ota_room_type`: OTA 房型名称或标识
- `local_room_type`: 本地房型编码，对应 `room_types.type_code`
- `local_room_type_name`: 本地房型名称（查询/保存响应通过关联 `room_types.type_name` 返回）
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 11. 抖音模式二（自助匹配）接口
> 历史资料：当前系统不再注册 `/api/douyin/*` 路由，本节接口不可用。

### 11.1 查询酒店静态信息（单页）
- Method: `POST`
- Path: `/api/douyin/hotel-info/query`
- 说明：
  - 对接抖音官方“自助匹配酒店信息查询接口”
  - 请求参数由后端统一校验，前端只需提交必要字段

请求体示例：

```json
{
  "accountId": "ACC_001",
  "pageIndex": 1,
  "pageSize": 20
}
```

成功响应示例：

```json
{
  "success": true,
  "summary": {
    "fetchedHotels": 1,
    "pageIndex": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "pagination": {
    "page_index": 1,
    "page_size": 20,
    "page_count": 1,
    "total_count": 1,
    "has_more": false
  },
  "data": [
    {
      "hotel_id": "7311111111111111111",
      "hotel_name": "阿苏晓筑",
      "account_id": "ACC_001"
    }
  ]
}
```

### 11.2 批量同步酒店静态信息
- Method: `POST`
- Path: `/api/douyin/hotel-info/sync`
- 说明：
  - 按页循环调用抖音酒店查询接口
  - 用于一次性拉取多页酒店信息，便于线下 mapping

请求体示例：

```json
{
  "accountId": "ACC_001",
  "startPageIndex": 1,
  "pageSize": 50,
  "maxPages": 20
}
```

成功响应示例：

```json
{
  "success": true,
  "summary": {
    "fetchedPages": 2,
    "fetchedHotels": 60,
    "startPageIndex": 1,
    "endPageIndex": 2,
    "hasMore": false
  },
  "pages": [
    {
      "pageIndex": 1,
      "pageSize": 50,
      "hasMore": true,
      "count": 50
    },
    {
      "pageIndex": 2,
      "pageSize": 50,
      "hasMore": false,
      "count": 10
    }
  ],
  "data": []
}
```

### 11.3 查询抖音房型映射列表
- Method: `GET`
- Path: `/api/douyin/room-type-mapping`
- 说明：
  - 返回本地 `room_types`、抖音物理房型缓存 `douyin_physical_rooms` 与当前 `douyin_room_type_mapping`
  - 前端“抖音房型匹配”页面使用该接口展示匹配状态
  - `matchStatus` 取值：
    - `UNMATCHED`：本地房型未匹配抖音房型
    - `MATCHED`：已匹配且本地存在抖音物理房型缓存
    - `MATCHED_BUT_ROOM_CACHE_MISSING`：存在映射但物理房型缓存缺失
    - `DOUYIN_ROOM_INACTIVE`：抖音房型缓存显示为下架/停用状态

成功响应示例：

```json
{
  "data": {
    "summary": {
      "localRoomTypeCount": 3,
      "matchedCount": 1,
      "unmatchedCount": 2,
      "douyinRoomCount": 4
    },
    "items": [
      {
        "localRoomType": "asu_xiao_zhu",
        "localRoomTypeName": "阿苏晓筑",
        "douyinRoomId": "DY_ROOM_001",
        "douyinRoomName": "阿苏晓筑大床房",
        "matchStatus": "MATCHED",
        "isMatched": true
      }
    ],
    "douyinRooms": [
      {
        "roomId": "DY_ROOM_001",
        "roomName": "阿苏晓筑大床房",
        "status": 1,
        "active": "true",
        "accountId": "DY_ACCOUNT_001",
        "hotelId": "DY_HOTEL_001",
        "boundLocalRoomType": "asu_xiao_zhu"
      }
    ]
  },
  "message": "抖音房型匹配列表获取成功"
}
```

### 11.4 刷新抖音物理房型缓存
- Method: `POST`
- Path: `/api/douyin/room-type-mapping/refresh`
- 说明：
  - 调用抖音 `physical_room/search` 获取当前酒店真实物理房型
  - 写入或更新 `douyin_physical_rooms`
  - `raw_payload` 会补入当前 `hotel_id/poi_id`，供套餐同步校验使用
  - 抖音返回的 `extra.logid` 会打印到后端日志，并在响应 `data.refresh.logId` 返回
- 请求体字段：
  - `accountId`：选填，未传时使用环境变量 `DOUYIN_ACCOUNT_ID`
  - `poiId`：选填，未传时使用环境变量 `DOUYIN_POI_ID`

请求示例：

```json
{
  "accountId": "DY_ACCOUNT_001",
  "poiId": "DY_HOTEL_001"
}
```

### 11.5 批量保存抖音房型映射
- Method: `POST`
- Path: `/api/douyin/room-type-mapping`
- 请求体字段：
  - `mappings`: 必填数组，格式：`[{localRoomType, douyinRoomId}]`
- 保存规则：
  - 本地房型必须存在于 `room_types`
  - 抖音房型必须存在于 `douyin_physical_rooms`
  - 同一个请求内 `localRoomType` 或 `douyinRoomId` 重复会被拒绝
  - 已绑定其他本地房型的抖音房型不能再次绑定
  - 同一个本地房型可以改绑到另一个未占用抖音房型
  - 数据库唯一约束兜底保证并发保存时仍是一对一

请求示例：

```json
{
  "mappings": [
    {
      "localRoomType": "asu_xiao_zhu",
      "douyinRoomId": "DY_ROOM_001"
    }
  ]
}
```

### 11.6 解除抖音房型映射
- Method: `DELETE`
- Path: `/api/douyin/room-type-mapping/:localRoomType`
- 说明：
  - 解除指定本地房型的抖音物理房型匹配
  - 不删除 `douyin_physical_rooms` 中的抖音物理房型缓存

### 11.7 查询本地套餐抖音同步列表
- Method: `GET`
- Path: `/api/douyin/rate-plans`
- 说明：
  - 历史资料：当前 `/api/douyin/rate-plans` 已随抖音路由停用
  - 本地套餐增删改查请使用 `/api/rate-plans`
  - 主表为 `rate_plans`
  - 左联 `rooms`、`room_types`、`douyin_room_type_mapping`、`douyin_physical_rooms`、`ota_channel_mappings`
  - 不会把本地数据异常误判为“未绑定抖音房型”
- 关键响应字段：
  - `localRatePlanId`: 本地套餐 ID
  - `ratePlanName`: 本地套餐名称
  - `localRoomExists`: 套餐关联房间是否存在
  - `localRoomTypeExists`: 套餐关联房型是否存在
  - `localDataStatus`: `OK`、`ROOM_MISSING`、`ROOM_TYPE_MISSING`
  - `douyinRoomId`: 已绑定的抖音物理房型 ID，未绑定时为 `null`
  - `douyinRatePlanId`: 已同步的抖音售卖房型 ID，未同步时为 `null`
  - `syncStatus`: 第一版只表示现有落库事实，成功为 `1`，未同步为 `null`

响应示例：

```json
{
  "success": true,
  "code": "DOUYIN_RATE_PLAN_LIST",
  "data": [
    {
      "localRatePlanId": 101,
      "roomId": 1,
      "ratePlanName": "阿苏晓筑-双早",
      "localDataStatus": "OK",
      "localRoomExists": true,
      "localRoomTypeExists": true,
      "douyinRoomId": "ROOM_001",
      "douyinRoomName": "阿苏晓筑大床房",
      "douyinRatePlanId": "RATE_001",
      "syncStatus": 1,
      "isDouyinRoomBound": true,
      "isSynced": true
    }
  ],
  "message": "抖音套餐同步列表获取成功"
}
```

### 11.6 本地售卖套餐 CRUD
- 说明：
  - 本地套餐管理接口为 `/api/rate-plans`
  - 抖音同步路由 `/api/douyin/rate-plans` 已停用
  - 套餐归属于本地房型 `room_types.type_code`
  - 抖音 `rate_plan_id` 不存入 `rate_plans`，继续由 `ota_channel_mappings` 维护
  - `rate_plans.id` 同步抖音时作为 `out_rate_plan_id`

#### 查询列表
- Method: `GET`
- Path: `/api/rate-plans`
- Query:
  - `roomTypeCode` / `room_type_code`：选填，按本地房型过滤

#### 查询单条
- Method: `GET`
- Path: `/api/rate-plans/:id`

#### 创建套餐
- Method: `POST`
- Path: `/api/rate-plans`
- 请求体字段：
  - `room_type_code`：必填，本地房型编码，必须存在于 `room_types`
  - `name`：必填，套餐名称，对应抖音 `rate_plan_name`
  - `base_price`：必填，本地基础价，必须大于等于 0
  - `status`：选填，`1` 启用，`0` 停用，可映射为抖音 `active`
  - `sales_type`：选填，`1` 全日房，`2` 钟点房，`3` 凌晨房
  - `currency`：选填，三位大写币种，默认 `CNY`
  - `hourly_earliest_check_in`：钟点房最早入住时间，格式 `HH:mm`
  - `hourly_latest_check_out`：钟点房最晚离店时间，格式 `HH:mm`
  - `hourly_usage_duration`：钟点房使用时长，范围 `1-23`
  - `midnight_latest_booking_time`：凌晨房最晚预定时间，范围 `1-6`
  - `midnight_enabled`：是否启用凌晨房规则
  - `douyin_config`：抖音扩展配置，只允许 JSON 对象
- 业务校验：
  - `sales_type=2` 时，必须同时提供完整钟点房字段
  - 同一房型下不能创建同名套餐

请求示例：

```json
{
  "room_type_code": "asu_xiao_zhu",
  "name": "阿苏晓筑-双早",
  "base_price": 399,
  "status": 1,
  "sales_type": 1,
  "currency": "CNY",
  "douyin_config": {
    "remark": "预售券基础套餐"
  }
}
```

成功响应示例：

```json
{
  "data": {
    "id": 101,
    "room_id": null,
    "room_type_code": "asu_xiao_zhu",
    "room_type_name": "阿苏晓筑",
    "name": "阿苏晓筑-双早",
    "base_price": 399,
    "status": 1,
    "sales_type": 1,
    "currency": "CNY",
    "douyin_rate_plan_id": null,
    "is_synced": false
  },
  "message": "售卖套餐创建成功"
}
```

#### 更新套餐
- Method: `PATCH`
- Path: `/api/rate-plans/:id`
- 请求体支持创建接口中的任意字段，至少传一个字段
- 若更新后的 `sales_type=2`，仍必须满足完整钟点房字段

#### 删除套餐
- Method: `DELETE`
- Path: `/api/rate-plans/:id`
- 删除规则：
  - 未同步到渠道的套餐允许删除
  - 如果存在 `ota_channel_mappings.local_target_type='RATE_PLAN'` 的映射，返回 `400`

#### 同步抖音预售券预定商品
- Method: `POST`
- Path: `/api/rate-plans/:id/douyin/sync`
- 说明：
  - 调用抖音官方“创建/更新预定商品”接口：`/goodlife/v1/trip/hotel/presale/rateplan/save/`
  - 本地套餐必须先通过 `douyin_room_type_mapping` 绑定抖音物理房型
  - 已绑定的抖音物理房型必须存在于 `douyin_physical_rooms`，否则需要先在“抖音房型匹配”页面刷新抖音房型
  - 物理房型缓存中的账号和酒店 ID 必须与本次同步使用的账号和酒店 ID 一致
  - `rate_plans.id` 会作为抖音 `out_rate_plan_id`
  - 已同步过的套餐会把本地 `ota_channel_mappings.channel_item_id` 作为抖音 `rate_plan_id` 继续更新
  - 同步成功后会写入 `ota_channel_mappings`，并更新 `douyin_physical_rooms.rate_plan_list`
  - 抖音返回的 `extra.logid` 会打印到后端日志；成功时保存到 `ota_channel_mappings.channel_config.log_id`，并返回给前端
  - 当前不支持 `sales_type=3` 凌晨房同步到抖音预售券预定商品
- 请求体字段：
  - `accountId`：选填，抖音商家账号 ID；未传时优先使用物理房型缓存账号，再回退环境变量 `DOUYIN_ACCOUNT_ID`
  - `poiId`：选填，抖音酒店 ID；未传时优先使用物理房型缓存中的酒店 ID，再回退环境变量 `DOUYIN_POI_ID`

请求示例：

```json
{
  "accountId": "DY_ACCOUNT_001",
  "poiId": "DY_HOTEL_001"
}
```

成功响应示例：

```json
{
  "data": {
    "rate_plan": {
      "id": 101,
      "room_type_code": "asu_xiao_zhu",
      "name": "阿苏晓筑-双早",
      "douyin_rate_plan_id": "DY_RATE_PLAN_001",
      "douyin_sync_status": 1,
      "is_synced": true
    },
    "douyin": {
      "success": true,
      "douyinId": "DY_RATE_PLAN_001",
      "outRatePlanId": "101",
      "roomId": "DY_ROOM_001",
      "hotelId": "DY_HOTEL_001",
      "logId": "20260420120000ABCDEF"
    }
  },
  "message": "售卖套餐同步抖音成功"
}
```

典型错误：
- `400 套餐所属房型尚未绑定抖音物理房型，无法同步`
- `400 抖音物理房型缓存缺失，请先刷新抖音房型后再同步套餐`
- `400 抖音物理房型所属账号与当前同步账号不一致，请刷新并重新匹配房型`
- `400 抖音物理房型所属酒店与当前同步酒店不一致，请刷新并重新匹配房型`
- `400 缺少抖音商家 account_id，请传 accountId 或配置 DOUYIN_ACCOUNT_ID`
- `400 缺少抖音酒店 ID，请传 poiId 或配置 DOUYIN_POI_ID`
- `400 抖音预售券预定商品暂不支持凌晨房套餐同步`
- `502 同步售卖套餐到抖音失败`：抖音接口 HTTP 或业务错误，响应 `error` 字段会带上抖音返回的错误描述，`douyin_log_id` 会带上抖音 `logid`
