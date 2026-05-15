# bill

## 模块职责

本模块负责账单查询、手工补收/退款、其他收入、按日期核对账单，以及自动房费账单任务。

## API 接口

- `GET /api/bills`
- `POST /api/bills/add`
- `POST /api/bills/other-income`
- `GET /api/bills/order/:orderId`
- `GET /api/bills/order/:orderId/details`
- `GET /api/bills/by-date/:date`
- `PUT /api/bills/:billId`
- `POST /api/bills/adjustment`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分，旧 `backend/routes/billRoute.js`、`backend/modules/billModule.js`、`backend/modules/autoBillService.js` 已可删除。

## 业务流程

- `GET /api/bills` -> `billService.getAllBills()`
- `POST /api/bills/add` -> controller 补全订单房间/客人/入住类型 -> `billService.addBill()`
- `POST /api/bills/other-income` -> `billService.createOtherIncome()`
- `GET /api/bills/order/:orderId` -> `billService.getBillsByOrderId()`
- `GET /api/bills/order/:orderId/details` -> `billService.getOrderBillDetails()`
- `GET /api/bills/by-date/:date` -> `billService.getBillsByDate()`
- `PUT /api/bills/:billId` -> `billService.updateBill()`
- `POST /api/bills/adjustment` -> controller 校验订单存在 -> `billService.addBill()`

## 依赖说明

- `../order-manage/orderManage.service`：仅在 controller 层用于补全账单创建和金额调整需要的订单信息。
- `./bill.repository`：账单 SQL 和自动账单 SQL。
- `./billAuto.service`：自动账单定时任务入口。

## 注意事项

- API 路径、请求格式和响应格式保持旧接口不变。
- `DATE` 字段按 `YYYY-MM-DD` 字符串处理，不使用 `toISOString()`。
- `timestamptz` 字段不做手动时区换算，写入时交给数据库处理。
- 退款和退押账单金额写为负数；补收和收押写为正数。
- `/api/bills/by-date/:date` 按 `create_time` 的日期筛选，并用 LATERAL 子查询避免多日订单重复展开同一账单。
