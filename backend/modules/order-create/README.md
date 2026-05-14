# order-create

## 模块职责

`order-create` 负责创建订单链路，包括创建待入住订单、快速入住、办理入住、创建订单定价拆分。

当前模块处于 Phase 3：已新增 `repository`。`getPricingBreakdown`、`createOrder`、`checkIn`、`fastCheckIn` 的主要业务流程和订单相关数据库访问已迁入 `orderCreate.service.js` / `orderCreate.repository.js`。

## API 接口

### POST /api/orders/new

用途：创建待入住订单。

请求体字段：

```json
{
  "orderId": "string",
  "sourceNumber": "string",
  "orderSource": "美团",
  "guestName": "张三",
  "roomType": "xing_yun_ge",
  "roomNumber": "403",
  "checkInDate": "2025-11-30",
  "checkOutDate": "2025-12-02",
  "status": "pending",
  "paymentMethod": "微信",
  "phone": "13812345678",
  "roomPrice": {
    "2025-11-30": 268,
    "2025-12-01": 288
  },
  "deposit": 200,
  "isPrepaid": false,
  "prepaidAmount": 0,
  "stayType": "客房",
  "createTime": "2025-11-29T10:30:00+08:00",
  "remarks": "需要安静房间"
}
```

成功响应：

```json
{
  "success": true,
  "message": "订单创建成功",
  "data": {
    "order": {}
  }
}
```

业务调用：`orderCreateService.createOrder(req.body)`，service 负责多日订单拆分和事务，订单写入委托 `orderCreate.repository.insertOrderDay()`。

### POST /api/orders/fast-check-in

用途：快速入住，创建订单后立即办理入住并生成账单。

请求体兼容 camelCase 和部分 snake_case 字段，controller 会归一化为 `orderData` 后校验。

成功响应：

```json
{
  "success": true,
  "message": "快速入住成功",
  "data": {}
}
```

业务调用：`orderCreateService.fastCheckIn(orderData, operator)`，service 在同一个事务中创建订单并办理入住。

### POST /api/orders/:orderId/check-in

用途：将待入住订单办理入住。

请求体：

```json
{
  "deposit": 200,
  "roomFeePaymentSplits": [
    { "method": "微信", "amount": 100 }
  ],
  "depositPaymentSplits": [
    { "method": "现金", "amount": 200 }
  ],
  "depositPaymentMethod": "现金"
}
```

成功响应：

```json
{
  "success": true,
  "message": "办理入住成功"
}
```

业务调用：`orderCreateService.checkIn(orderId, deposit, paymentSplitPayload)`，service 负责办理入住流程，订单和房态更新委托 `orderCreate.repository`，账单写入继续使用 `billModule.addBill()`。

### POST /api/orders/pricing/breakdown

用途：创建订单页定价拆分。

请求体：

```json
{
  "checkInDate": "2025-11-01",
  "checkOutDate": "2025-11-03",
  "mode": "from-room-price",
  "basePrice": 100
}
```

或：

```json
{
  "checkInDate": "2025-11-01",
  "checkOutDate": "2025-11-03",
  "mode": "distribute-total",
  "totalPrice": 300
}
```

成功响应：

```json
{
  "success": true,
  "data": {}
}
```

业务调用：`orderCreateService.getPricingBreakdown(req.body)`，service 负责定价拆分规则，日期序列查询委托 `orderCreate.repository.listStayDates()`。

## 业务流程

- `orderCreate.routes.js` 只绑定 `/api/orders` 下的创建订单相关路径。
- `orderCreate.controller.js` 处理 `req` / `res`、参数提取、响应格式和错误映射。
- `orderCreate.service.js` 作为创建订单功能的业务调用边界；定价拆分、创建订单、办理入住和快速入住已迁入 service。
- `orderCreate.repository.js` 保存日期序列查询、订单写入、办理入住订单/房态更新 SQL，以及快速入住返回结果需要的账单查询。
- `orderCreate.validator.js` 保存 AJV schema 和字段归一化逻辑。
- Phase 3 已迁移创建订单模块的主要流程；旧 `orderModule` 已移除。

## 依赖说明

- `../tools`
- `../order-manage/orderManage.repository`
- `../../database/postgreDB/pg`
- `ajv`
- `ajv-formats`

## 测试

模块内单元测试放在：

```txt
backend/modules/order-create/__tests__/
```

现有真实 API 和数据库集成测试继续保留在：

```txt
backend/tests/createOrder.test.js
backend/tests/checkIn.test.js
backend/tests/pricing_breakdown.test.js
```

当前推荐验收命令：

```bash
npm --workspace backend run test -- modules/order-create/__tests__/orderCreate.validator.test.js
npm --workspace backend run test -- modules/order-create/__tests__/orderCreate.service.test.js
npm --workspace backend run test -- tests/createOrder.test.js tests/checkIn.test.js tests/pricing_breakdown.test.js
```

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()`。
- Phase 3 已移动定价拆分、创建订单、办理入住和快速入住；旧 `orderModule` 已移除。
- 订单管理路由已迁入 `backend/modules/order-manage/orderManage.routes.js`。
