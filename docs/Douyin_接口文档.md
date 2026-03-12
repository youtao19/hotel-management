# 抖音直连接口文档

## 1. 文档范围
- 本文档覆盖抖音直连一期后端接口。
- 所有接口统一挂载在 `/ota/douyin`。
- 出站同步已切换为抖音官方 Node SDK：
  - `@open-dy/open_api_sdk`
  - `@open-dy/open_api_credential`
- 一期已实现接口：
  - `POST /ota/douyin/order/create`
  - `POST /ota/douyin/order/cancel`
  - `POST /ota/douyin/room/sync`
  - `POST /ota/douyin/room/static/sync`
  - `POST /ota/douyin/webhook`
  - `GET /ota/douyin/admin/account`
  - `POST /ota/douyin/admin/account`

## 2. 鉴权约定
- `order/create` 与 `order/cancel` 必须携带以下请求头：
  - `x-douyin-client-key`
  - `x-douyin-timestamp`
  - `x-douyin-signature`
- 签名算法：

```text
signature = HMAC_SHA256(inbound_secret, timestamp + "\n" + rawBody)
```

- `timestamp` 支持 10 位秒级或 13 位毫秒级时间戳。
- 时间戳允许误差：`300` 秒。
- `room/sync` 为内部触发接口，一期不做抖音签名校验。
- `webhook` 验证与事件接收支持 `x-douyin-signature`：

```text
signature = SHA1(app_secret + rawBody)
```

## 3. 通用响应
### 3.1 成功响应

```json
{
  "success": true,
  "data": {}
}
```

### 3.2 失败响应

```json
{
  "success": false,
  "message": "错误说明",
  "error": {
    "code": "DOUYIN_XXX",
    "details": null
  }
}
```

## 4. 创建订单
### 4.1 请求
- Method: `POST`
- Path: `/ota/douyin/order/create`
- 说明：
  - 幂等键优先使用 `douyin_order_id`，其次辅助校验 `order_out_id`。
  - 后端会根据 `room_id + rate_plan_id` 查找本地房型映射。
  - 后端会校验价格是否与本地房型基准价一致。
  - 后端自动分配房间号，并创建内部 `orders` 记录。

请求体示例：

```json
{
  "douyin_order_id": "DY202603090001",
  "order_out_id": "OUT202603090001",
  "guest_name": "张三",
  "phone": "13800138000",
  "room_id": "dy-room-1",
  "rate_plan_id": "rp-1",
  "check_in_date": "2026-03-10",
  "check_out_date": "2026-03-12",
  "total_price": 400,
  "payment_method": "平台",
  "remarks": "抖音创单"
}
```

也支持直接透传每日价：

```json
{
  "douyin_order_id": "DY202603090002",
  "guest_name": "李四",
  "room_id": "dy-room-1",
  "rate_plan_id": "rp-1",
  "check_in_date": "2026-03-10",
  "check_out_date": "2026-03-12",
  "daily_prices": {
    "2026-03-10": 200,
    "2026-03-11": 200
  }
}
```

### 4.2 成功响应
- 首次创建返回 `201`：

```json
{
  "success": true,
  "existing": false,
  "data": {
    "internal_order_id": "OTA-DY-1741500000000-ab12cd",
    "douyin_order_id": "DY202603090001",
    "order_out_id": "OUT202603090001",
    "hotel_confirm_number": "DYCF1741500000000ABCD",
    "local_room_type": "DY_ROOM",
    "douyin_room_id": "dy-room-1",
    "douyin_rate_plan_id": "rp-1",
    "order_status": "confirmed",
    "pay_status": "unpaid",
    "cancel_status": "none"
  }
}
```

- 重复请求返回 `200`：

```json
{
  "success": true,
  "existing": true,
  "data": {
    "internal_order_id": "OTA-DY-1741500000000-ab12cd",
    "douyin_order_id": "DY202603090001"
  }
}
```

### 4.3 典型错误
- `401 DOUYIN_AUTH_INVALID_SIGNATURE`：签名错误
- `404 DOUYIN_ROOM_MAPPING_NOT_FOUND`：房型映射不存在
- `409 DOUYIN_ORDER_PRICE_MISMATCH`：价格不匹配
- `409 DOUYIN_INVENTORY_CONFLICT`：库存不足
- `409 DOUYIN_ROOM_NOT_AVAILABLE`：无房可分配

## 5. 取消订单
### 5.1 请求
- Method: `POST`
- Path: `/ota/douyin/order/cancel`
- 说明：
  - 可用 `douyin_order_id` 或 `order_out_id` 定位订单。
  - 未入住订单取消后会释放未来库存。
  - 已入住订单不可取消。
  - 重复取消保持幂等。

请求体示例：

```json
{
  "douyin_order_id": "DY202603090001",
  "cancel_reason": "用户主动取消"
}
```

### 5.2 成功响应

```json
{
  "success": true,
  "cancelled": true,
  "alreadyCancelled": false,
  "data": {
    "douyin_order_id": "DY202603090001",
    "order_out_id": "OUT202603090001",
    "internal_order_id": "OTA-DY-1741500000000-ab12cd"
  }
}
```

重复取消示例：

```json
{
  "success": true,
  "cancelled": true,
  "alreadyCancelled": true,
  "data": {
    "douyin_order_id": "DY202603090001"
  }
}
```

### 5.3 典型错误
- `404 DOUYIN_ORDER_NOT_FOUND`：订单不存在
- `409 DOUYIN_ORDER_CANCEL_FORBIDDEN`：已入住订单不可取消

## 6. 房态同步任务
### 6.1 请求
- Method: `POST`
- Path: `/ota/douyin/room/sync`
- 说明：
  - 该接口只负责创建同步任务，不直接同步到抖音。
  - 实际对外发送由 `douyin_outbox` 异步处理。
  - outbox 消费时使用抖音官方 SDK：
    - 库存同步调用 `/goodlife/v1/trip/hotel/stock/save/`
    - 价格同步调用 `/goodlife/v1/trip/hotel/price/save/`
  - `syncTypes` 支持：
    - `inventory`
    - `price`
  - 同一房型、同一日期范围、同一同步类型会做任务去重。
  - 若要真正发起 SDK 同步，账号配置中必须补齐：
    - `accountId`
    - `hotelId`
  - 若房型映射开启价格或库存同步，则 `douyinRatePlanId` 必须已配置。
  - 为满足 SDK 出站校验，系统会在 `request_payload.items[]` 内补齐：
    - `room_id`
    - `rate_plan_id`
  - SDK 成功返回后会解析并保存 `response_payload.logid`，用于联调页面粘贴校验。
  - 任务重试失败时，接口返回中会补充 `last_logid`（从抖音错误报文中提取），用于快速排查。

请求体示例：

```json
{
  "roomType": "DY_ROOM",
  "startDate": "2026-03-10",
  "endDate": "2026-03-12",
  "syncTypes": ["inventory", "price"]
}
```

### 6.2 成功响应

```json
{
  "success": true,
  "data": {
    "room_type": "DY_ROOM",
    "start_date": "2026-03-10",
    "end_date": "2026-03-12",
    "jobs": [
      {
        "id": 1,
        "sync_type": "inventory",
        "local_room_type": "DY_ROOM",
        "task_status": "pending",
        "existing": false
      },
      {
        "id": 2,
        "sync_type": "price",
        "local_room_type": "DY_ROOM",
        "task_status": "pending",
        "existing": false
      }
    ]
  }
}
```

### 6.3 典型错误
- `404 DOUYIN_SYNC_MAPPING_NOT_FOUND`：没有可同步的房型映射
- `400 DOUYIN_SYNC_DATE_RANGE_INVALID`：日期范围错误
- `400 DOUYIN_SYNC_TYPE_INVALID`：同步类型错误
- `409 DOUYIN_RATE_PLAN_ID_REQUIRED`：房型映射缺少 `douyinRatePlanId`
- `503 DOUYIN_ACCOUNT_ID_REQUIRED`：账号配置缺少 `accountId`
- `503 DOUYIN_HOTEL_ID_REQUIRED`：账号配置缺少 `hotelId`

## 7. 账号配置接口
### 7.1 获取账号配置
- Method: `GET`
- Path: `/ota/douyin/admin/account`

成功响应示例：

```json
{
  "success": true,
  "data": {
    "account_code": "default",
    "client_key": "inbound-client-key",
    "inbound_secret": "inbound-secret",
    "app_id": "douyin-app-id",
    "app_secret": "douyin-app-secret",
    "account_id": "life-account-id",
    "hotel_id": "hotel-id",
    "access_token": "manual-token",
    "token_expire_at": null,
    "enabled": true,
    "mock_mode": "none"
  }
}
```

### 7.2 保存账号配置
- Method: `POST`
- Path: `/ota/douyin/admin/account`
- 说明：
  - `clientKey`、`inboundSecret` 仍用于入站创单/取消签名校验。
  - `appId`、`appSecret` 用于 SDK 获取 access token。
  - `accountId`、`hotelId` 用于 SDK 的酒店价量接口。
  - `accessToken` 仍可手工填写；若为空，则后端优先使用 `appId + appSecret` 通过 SDK 取 token。

请求体示例：

```json
{
  "accountCode": "default",
  "clientKey": "inbound-client-key",
  "inboundSecret": "inbound-secret",
  "appId": "douyin-app-id",
  "appSecret": "douyin-app-secret",
  "accountId": "life-account-id",
  "hotelId": "hotel-id",
  "accessToken": "",
  "enabled": true,
  "mockMode": "none"
}
```

## 8. Webhooks 回调接口
### 8.1 请求网址 URL
- Method: `POST`
- Path: `/ota/douyin/webhook`
- 说明：
  - 用于抖音开放平台「Webhooks 配置」中的请求网址 URL。
  - URL 验证阶段，抖音会推送 `event=verify_webhook`，并携带 `content.challenge`。
  - 兼容两种 challenge 传递方式：
    - `content.challenge`（JSON 请求体）
    - `challenge`（query 参数）
  - 兼容 `application/json` 与 `text/plain(JSON 字符串)` 两种请求体格式。
  - 响应 `Content-Type` 为 `text/plain; charset=utf-8`，响应体内容为 JSON 文本。
  - 后端会回包：

```json
{
  "challenge": "平台下发的 challenge 原文"
}
```

### 8.2 非 verify 事件
- 后端当前会先接收并返回 `success=true`，用于保证平台事件投递成功。
- 后续可按业务需要追加事件分发处理。

## 9. 售卖房型静态信息同步任务
### 9.1 请求
- Method: `POST`
- Path: `/ota/douyin/room/static/sync`
- 对应抖音 OpenAPI：
  - `POST https://open.douyin.com/goodlife/v1/trip/hotel/rateplan/save/`
- 说明：
  - 该接口用于创建 outbox 任务，异步调用抖音售卖房型静态信息接口。
  - 任务内部固定按文档必填项构建：
    - `account_id`（来自账号配置）
    - `rate_plan.rooms[].room_id`（来自 `douyin_room_mapping.douyin_room_id`）
    - `rate_plan.rooms[].rate_plans[].out_rate_plan_id`
    - `rate_plan.rooms[].rate_plans[].rate_plan_name`
  - 同一请求体会按 payload 指纹去重，避免重复创建 pending/retrying 任务。

请求体示例：

```json
{
  "roomType": "DY_ROOM",
  "ratePlanName": "标准价",
  "active": true,
  "policy": 1,
  "settleType": 1,
  "salesType": 1,
  "confirmImmediately": true,
  "currency": "CNY"
}
```

### 9.2 成功响应

```json
{
  "success": true,
  "data": {
    "room_type": "DY_ROOM",
    "jobs": [
      {
        "id": 11,
        "sync_type": "rateplan",
        "local_room_type": "DY_ROOM",
        "task_status": "pending",
        "existing": false
      }
    ]
  }
}
```

### 9.3 典型错误
- `404 DOUYIN_SYNC_MAPPING_NOT_FOUND`：没有可同步的房型映射
- `409 DOUYIN_RATEPLAN_ROOM_ID_REQUIRED`：映射缺少 `douyin_room_id`
- `503 DOUYIN_ACCOUNT_ID_REQUIRED`：账号配置缺少 `accountId`
- `503 DOUYIN_HOTEL_ID_REQUIRED`：账号配置缺少 `hotelId`

## 10. 数据落点
- 内部订单：`orders`
- 抖音订单主表：`douyin_order`
- 抖音事件流水：`douyin_order_event`
- 抖音出站队列：`douyin_outbox`
- 抖音房型映射：`douyin_room_mapping`
- 抖音账号配置：`douyin_account_config`
