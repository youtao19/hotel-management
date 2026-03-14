# OTA 接口文档

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

## 8. 插件接单接口（动态签名）

### 8.1 请求
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

### 8.2 典型鉴权错误码
- `PLUGIN_AUTH_NOT_CONFIGURED`：服务端未配置 key/secret
- `PLUGIN_AUTH_MISSING_HEADERS`：缺少签名请求头
- `PLUGIN_AUTH_INVALID_KEY`：`x-plugin-key` 不匹配
- `PLUGIN_AUTH_INVALID_TIMESTAMP`：时间戳格式错误
- `PLUGIN_AUTH_TIMESTAMP_EXPIRED`：时间戳超窗
- `PLUGIN_AUTH_INVALID_NONCE`：nonce 长度不合法
- `PLUGIN_AUTH_NONCE_REPLAYED`：nonce 重放
- `PLUGIN_AUTH_INVALID_SIGNATURE`：签名不匹配

### 8.3 关系表快照落库字段
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

### 8.4 插件鉴权环境变量
- `PLUGIN_API_KEY`: 插件调用方标识
- `PLUGIN_API_SECRET`: 插件签名密钥
- `PLUGIN_SIGN_SKEW_SECONDS`: 时间戳允许偏差秒数（默认 `300`）
- `PLUGIN_NONCE_TTL_SECONDS`: nonce 防重放缓存秒数（默认 `600`）

## 9. 插件房型映射接口

### 9.1 鉴权方式
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
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:00:00+08"
    },
    {
      "id": 2,
      "platform": "meituan",
      "ota_room_type": "行云阁 大床房",
      "local_room_type": "xing_yun_ge",
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
- `label`: 本地房型名称，当前仅用于插件侧展示，服务端当前不落库

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
      "created_at": "2026-03-14 10:00:00+08",
      "updated_at": "2026-03-14 10:05:00+08"
    },
    {
      "id": 2,
      "platform": "meituan",
      "ota_room_type": "行云阁 大床房",
      "local_room_type": "xing_yun_ge",
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
- `created_at`: 创建时间
- `updated_at`: 更新时间
