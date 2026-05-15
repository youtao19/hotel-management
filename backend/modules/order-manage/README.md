# order-manage

## 模块职责

`order-manage` 负责订单列表、订单详情、订单编辑、订单状态变更、每日换房、整单换房、退房、提前退房和押金退款相关接口。

## API 接口

- `GET /api/orders`
- `GET /api/orders/daily`
- `GET /api/orders/:id`
- `POST /api/orders/:orderNumber/status`
- `PUT /api/orders/:orderNumber`
- `PUT /api/orders/:orderNumber/day-room`
- `POST /api/rooms/change-room`
- `PUT /api/orders/:orderNumber/with-bills`
- `GET /api/orders/:orderNumber/early-checkout/recommendation`
- `POST /api/orders/:orderNumber/early-checkout`
- `POST /api/orders/:order_id/refund-deposit`
- `GET /api/orders/:order_id/deposit-info`
- `POST /api/orders/:orderId/check-out`

## 当前阶段

Phase 3（订单管理流程已完成）: routes/controller/validator/service/repository 已拆分。只读查询 `listOrders`、`listDailyOrders`、`getOrder`、`getOrderRowById`、提前退房建议 `getEarlyCheckoutRecommendation`、基础编辑 `updateOrder`、联合编辑 `updateOrderWithBills`、押金状态 `getDepositInfo`、状态更新 `updateOrderStatus`、每日换房 `updateOrderDayRoom`、整单换房 `changeOrderRoom`、退押金 `refundDeposit`、正常退房 `checkOut`、提前退房 `earlyCheckout` 已迁入本模块，旧 `orderModule.js` 已移除。

## 业务流程

- `GET /api/orders` -> `orderManageService.listOrders()` -> `orderManageRepository.listOrders()`
- `GET /api/orders/daily` -> `orderManageService.listDailyOrders()` -> `orderManageRepository.listDailyOrders()`
- `GET /api/orders/:id` -> `orderManageService.getOrder()` -> `orderManageRepository.findOrderRowsByOrderId()`
- `POST /api/orders/:orderNumber/status` -> `orderManageService.updateOrderStatus()` -> `orderManageRepository.updateOrderStatus()`
- `PUT /api/orders/:orderNumber` -> `orderManageService.updateOrder()` -> `orderManageRepository`
- `PUT /api/orders/:orderNumber/day-room` -> `orderManageService.updateOrderDayRoom()` -> `orderManageRepository`
- `POST /api/rooms/change-room` -> `orderManageService.changeOrderRoom()` -> `orderManageRepository`
- `PUT /api/orders/:orderNumber/with-bills` -> `orderManageService.updateOrderWithBills()` -> `orderManageRepository`
- `GET /api/orders/:orderNumber/early-checkout/recommendation` -> `orderManageService.getEarlyCheckoutRecommendation()` -> `orderManageRepository.findOrderRowsByOrderId()`
- `POST /api/orders/:orderNumber/early-checkout` -> `orderManageService.earlyCheckout()` -> `orderManageRepository`
- `POST /api/orders/:order_id/refund-deposit` -> `orderManageService.refundDeposit()` -> `orderManageRepository.findOrderRowsByOrderId()` + `bill/bill.service.addBill()`
- `GET /api/orders/:order_id/deposit-info` -> `orderManageService.getDepositInfo()` -> `orderManageRepository.getDepositInfo()`
- `POST /api/orders/:orderId/check-out` -> `orderManageService.checkOut()` -> `orderManageRepository`

## 依赖说明

- `../auth/auth.middleware`
- `../../database/postgreDB/pg`
- `ajv`
- `ajv-formats`

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- DATE 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()`。
- `POST /api/rooms/change-room` 是旧公开路径，仍挂载在 `/api/rooms`，但业务归 `order-manage`。
- Phase 3 目前已移动只读 SQL、提前退房建议读取逻辑、基础编辑 SQL、联合订单账单编辑 SQL、押金状态 SQL、订单状态更新 SQL、每日换房 SQL、整单换房事务、退押账单创建流程、正常退房事务和提前退房事务。
- 旧 `backend/modules/orderModule.js` 已移除，订单管理调用方应直接依赖 `order-manage`。
- 固定路径要放在 `/:id` 这类参数路径之前，避免后续新增同方法固定路由时被参数路由拦截。
