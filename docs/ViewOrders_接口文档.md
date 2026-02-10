# ViewOrders 接口文档

## 1. 文档范围
本文档仅覆盖 `/ViewOrders` 页面实际使用到的接口（含关联页面弹窗能力）。

对应代码：
- 前端接口封装：`frontend/src/api/index.js`
- 后端路由：`backend/routes/orderRoute.js`、`backend/routes/roomRoute.js`、`backend/routes/billRoute.js`

## 2. 基础约定
- 前端 Axios `baseURL`：`/api`
- 前端默认 `withCredentials: true`（会携带 session cookie）
- 页面主路由：`/ViewOrders`

### 2.1 通用状态码（约定）
- `200` 成功
- `201` 创建成功
- `400` 参数/业务校验失败
- `404` 资源不存在
- `500` 服务端异常

### 2.2 业务枚举
#### 订单状态
- `pending` 待入住
- `checked-in` 已入住
- `checked-out` 已退房
- `cancelled` 已取消
- （后端也定义了 `reserved`、`occupied`，但该页面主要使用上面四种）

#### 支付方式（核心）
- `现金`
- `微信`
- `微邮付`
- `平台`

## 3. 接口清单

## 3.1 订单查询

### 3.1.1 获取订单列表
- Method：`GET`
- Path：`/api/orders`
- 用途：列表加载、刷新
- Query：无（前端会加 `_` 防缓存参数）
- 成功响应示例：
```json
{
  "data": [
    {
      "order_id": "ORD20260208001",
      "guest_name": "张三",
      "room_number": "201",
      "status": "pending",
      "total_price": 520,
      "deposit": 100
    }
  ]
}
```

### 3.1.2 获取订单详情（按日明细）
- Method：`GET`
- Path：`/api/orders/:id`
- 用途：打开详情弹窗后拉取完整数据
- 成功响应示例：
```json
{
  "data": [
    {
      "order_id": "ORD20260208001",
      "stay_date": "2026-02-10",
      "room_number": "201",
      "total_price": 260
    },
    {
      "order_id": "ORD20260208001",
      "stay_date": "2026-02-11",
      "room_number": "201",
      "total_price": 260
    }
  ]
}
```

## 3.2 订单状态流转

### 3.2.1 更新订单状态（取消等）
- Method：`POST`
- Path：`/api/orders/:orderNumber/status`
- 用途：取消订单（前端传 `cancelled`）
- Body：
```json
{ "newStatus": "cancelled" }
```
- 成功响应：
```json
{
  "message": "订单状态更新成功",
  "order": { "order_id": "ORD20260208001", "status": "cancelled" }
}
```

### 3.2.2 办理入住
- Method：`POST`
- Path：`/api/orders/:orderId/check-in`
- 用途：待入住转已入住，生成房费/押金账单
- Body（常用）：
```json
{
  "deposit": 100,
  "depositPaymentMethod": "微信",
  "roomFeePaymentSplits": [
    { "method": "现金", "amount": 200 },
    { "method": "微信", "amount": 300 }
  ],
  "depositPaymentSplits": [
    { "method": "现金", "amount": 50 },
    { "method": "微信", "amount": 50 }
  ]
}
```
- 说明：
  - `roomFeePaymentSplits` 既支持数组，也支持按日期对象（后端可识别两种格式）。
  - 拆分金额必须与应收金额严格相等。
- 成功响应：
```json
{ "success": true, "message": "办理入住成功" }
```
- 典型错误：
  - `404`：订单不存在
  - `400`：订单不是 `pending`、拆分金额不平衡

### 3.2.3 办理退房
- Method：`POST`
- Path：`/api/orders/:orderId/check-out`
- 用途：已入住转已退房，房间转清洁中
- Body：`{}`
- 成功响应：
```json
{
  "success": true,
  "message": "办理退房成功",
  "data": []
}
```

### 3.2.4 提前退房推荐
- Method：`GET`
- Path：`/api/orders/:orderNumber/early-checkout/recommendation`
- Query：
  - `actualCheckoutTime`：`YYYY-MM-DDTHH:mm`
  - `hasStayed`：`true/false`
- 用途：返回系统建议退款金额和可退日期明细
- 成功响应：
```json
{
  "success": true,
  "data": {
    "recommendedRefund": 120,
    "refundableNights": [
      { "stayDate": "2026-01-11", "roomPrice": 120 }
    ]
  }
}
```

### 3.2.5 提前退房提交
- Method：`POST`
- Path：`/api/orders/:orderNumber/early-checkout`
- Body：
```json
{
  "actualCheckoutTime": "2026-02-08T10:30",
  "refundAmount": 120,
  "refundMethod": "微信",
  "operator": "peach",
  "remarks": "客人提前离店",
  "hasStayed": true
}
```
- 成功响应：
```json
{
  "success": true,
  "message": "提前退房办理成功",
  "data": {
    "success": true,
    "order": []
  }
}
```
- 典型错误：
  - `400`：实际退房时间无效、退款金额无效或超上限、状态不允许
  - `404`：订单不存在

## 3.3 押金接口

### 3.3.1 退押金
- Method：`POST`
- Path：`/api/orders/:order_id/refund-deposit`
- Body（前端实际提交）：
```json
{
  "order_id": "ORD20260208001",
  "change_price": 80,
  "pay_way": "微信",
  "notes": "正常退押",
  "operator": "peach",
  "deduct_amount": 0,
  "create_time": "2026-02-08T12:00:00.000Z"
}
```
- 说明：
  - 业务只允许 `checked-out`/`cancelled` 且有剩余押金的订单退押。
  - 后端会将 `change_price` 入账为负数（`退押`类型）。
  - 路径参数 `:order_id` 目前未在路由内直接使用，后端以 `body.order_id` 为准。
- 成功响应：
```json
{
  "message": "退押金处理成功",
  "order": {
    "change_type": "退押",
    "change_price": -80
  }
}
```

### 3.3.2 查询押金状态
- Method：`GET`
- Path：`/api/orders/:order_id/deposit-info`
- 用途：详情弹窗、退押弹窗显示押金余额与历史
- 成功响应：
```json
{
  "success": true,
  "data": {
    "orderId": "ORD20260208001",
    "deposit": 100,
    "refunded": 20,
    "remaining": 80,
    "refundRecords": [
      { "amount": 20, "method": "微信", "time": "2026-02-08 12:01:00" }
    ],
    "totalRoomFee": 520
  }
}
```

## 3.4 订单编辑与按日房间

### 3.4.1 修改订单（联合账单更新）
- Method：`PUT`
- Path：`/api/orders/:orderNumber/with-bills`
- 用途：修改订单弹窗保存（客人信息/房费/押金/支付方式等）
- Body：
```json
{
  "orderData": {
    "guest_name": "张三",
    "phone": "13800138000",
    "room_type": "bo_ye_shuang",
    "room_number": "307",
    "remarks": "改到高楼层",
    "deposit": 120,
    "payment_method": "微信"
  },
  "roomPrice": {
    "2026-02-10": 280,
    "2026-02-11": 260
  },
  "changedBy": "user"
}
```
- 成功响应：
```json
{
  "success": true,
  "message": "订单和账单更新成功",
  "order": [],
  "billUpdates": [
    { "stayDate": "2026-02-10", "orderUpdated": 1, "billUpdated": 1 }
  ]
}
```

### 3.4.2 按日换房
- Method：`PUT`
- Path：`/api/orders/:orderNumber/day-room`
- Body：
```json
{
  "stayDate": "2026-02-10",
  "newRoomNumber": "108"
}
```
- 成功响应：
```json
{
  "success": true,
  "message": "订单 ORD20260208001 的 2026-02-10 房间已更换为 108",
  "data": {}
}
```

## 3.5 续住相关

### 3.5.1 创建续住订单
- Method：`POST`
- Path：`/api/orders/new`
- 用途：续住弹窗提交后创建新订单（通常状态为 `pending`）
- Body（续住场景常用）：
```json
{
  "orderId": "ORDEXT0208123456",
  "sourceNumber": "ORD20260208001",
  "orderSource": "续住",
  "guestName": "张三[续3456]",
  "phone": "13800138000",
  "roomType": "bo_ye_shuang",
  "roomNumber": "307",
  "checkInDate": "2026-02-12",
  "checkOutDate": "2026-02-13",
  "status": "pending",
  "paymentMethod": "现金",
  "roomPrice": { "2026-02-12": 280 },
  "deposit": 0,
  "stayType": "客房",
  "isPrepaid": false,
  "prepaidAmount": 0,
  "remarks": "续住订单..."
}
```
- 成功响应：
```json
{
  "success": true,
  "message": "订单创建成功",
  "data": {
    "order": {}
  }
}
```

## 3.6 房间查询与换房

### 3.6.1 查询区间可用房
- Method：`GET`
- Path：`/api/rooms/available`
- Query：
  - `startDate=YYYY-MM-DD`
  - `endDate=YYYY-MM-DD`
  - `typeCode`（可选）
- 成功响应：
```json
{
  "data": [
    { "room_number": "108", "type_code": "asu_xiao_zhu", "price": 288 }
  ],
  "query": {
    "startDate": "2026-02-10",
    "endDate": "2026-02-12",
    "typeCode": null
  }
}
```

### 3.6.2 整单更换房间
- Method：`POST`
- Path：`/api/rooms/change-room`
- Body：
```json
{
  "orderNumber": "ORD20260208001",
  "oldRoomNumber": "202",
  "newRoomNumber": "401"
}
```
- 成功响应：
```json
{
  "success": true,
  "message": "房间更换成功",
  "updatedOrder": {},
  "newRoom": {
    "room_number": "401",
    "type_code": "yun_ju_ying_yin",
    "price": 428
  }
}
```
- 常见错误码：
  - `MISSING_PARAMS`
  - `SAME_ROOM`
  - `ORDER_STATUS_INVALID`
  - `NEW_ROOM_NOT_FOUND`
  - `NEW_ROOM_CLOSED`
  - `NEW_ROOM_REPAIR`
  - `NEW_ROOM_NOT_AVAILABLE`
  - `NEW_ROOM_CONFLICT`

## 3.7 账单接口（页面内使用）

### 3.7.1 获取订单账单列表（用于退押可用性计算）
- Method：`GET`
- Path：`/api/bills/order/:orderId`
- 成功响应：
```json
{
  "data": [
    {
      "order_id": "ORD20260208001",
      "change_type": "退押",
      "change_price": -20,
      "pay_way": "微信"
    }
  ]
}
```

### 3.7.2 全量账单（页面初始化会触发）
- Method：`GET`
- Path：`/api/bills`
- 成功响应：
```json
{
  "bills": []
}
```

### 3.7.3 金额调整
- Method：`POST`
- Path：`/api/bills/adjustment`
- Body：
```json
{
  "order_id": "ORD20260208001",
  "change_price": 50,
  "change_type": "补收",
  "method": "微邮付",
  "notes": "卖了簪子"
}
```
- 成功响应：
```json
{
  "success": true,
  "data": {}
}
```

## 4. 前端对象映射说明
`/ViewOrders` 页面内常见字段映射（后端 -> 前端）：
- `order_id` -> `orderNumber`
- `guest_name` -> `guestName`
- `room_type` -> `roomType`
- `room_number` -> `roomNumber`
- `check_in_date` -> `checkInDate`
- `check_out_date` -> `checkOutDate`
- `payment_method` -> `paymentMethod`
- `refunded_deposit` -> `refundedDeposit`

## 5. 联调建议
- 优先跑已有测试验证流程：
  - `backend/tests/checkIn.test.js`
  - `backend/tests/bill.test.js`（退押）
  - `backend/tests/earlyCheckoutRecommendation.test.js`
  - `e2e/order-manage/*.spec.js`
- 接口异常时优先核对：
  - 订单状态是否满足操作前置条件
  - 金额是否保留两位且总和一致
  - 日期格式是否为 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm`
