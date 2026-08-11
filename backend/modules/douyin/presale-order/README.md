# 预售券订单

## 官方交易逆向接口

- [售后审核结果返回](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/callback-cancellation)：异步取消模式下，服务商调用抖音接口回传 `cancel_Id`、`order_id`、`cancel_type` 和审核结论。
- [订单取消退款通知 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/refund-notification)：抖音完成退款后通知服务商实际退款结果，响应不会改变退款结果。
- [酒店取消订单 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/cancel-hotel-order)：抖音通知服务商处理取消申请；同一 `cancel_id` 可能重复投递，必须幂等。

## 官方正向交易接口

- [创建预售订单 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-pre-sale-order)：抖音创建 `biz_type=2011` 预售券购买主订单。
- [支付结果通知 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/paynotice)：预售券购买主订单支付完成后的通知。
- [可订检查 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/bookable-check)：创建预约前查询指定入住日期、房型和价格是否可订。
- [创建预约 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-booking-order)：抖音创建 `biz_type=2012` 预约订单，`source_order_id` 关联原 `2011` 预售券订单。
- [确认接单接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/order-confirmation-api)：仅在创建预约响应选择异步接单时，由服务商调用抖音确认预约订单。

## 当前覆盖情况

- 已实现：`POST /douyin/spi/presale-order/create` 创建 `2011` 预售券订单，以及 `POST /douyin/spi/presale-order/payment-notice` 接收其支付结果；两者验签、按抖音订单号幂等，并记录回调 `X-Bytedance-Logid`。
- 已实现：`POST /douyin/spi/presale-order/booking` 创建 `2012` 预约订单；校验已支付的来源 `2011` 订单、抖音酒店/房型映射、可订价量态和 `daily_rates`，在事务内锁房并写入本地库存订单。
- 已实现：预约 SPI 始终返回 `confirm_mode=2`。开启自动接单时，响应发送后异步调用确认接单接口；关闭时由员工在预约订单列表中手动接单或拒单。接单前会再次校验已分配房间未维修且未关闭：人工接单直接拦截，自动接单会向抖音回传拒单。确认请求和响应的 `logid`、失败原因及状态持久化到 `douyin_presale_booking_orders`。
- 尚待产品规则配置：可订检查和预约创单当前只校验入住人数为正数，尚未配置每房最大入住人数、会员校验、餐食、钟点房等额外限制。

## 创建预约 SPI

- 回调地址：`POST /douyin/spi/presale-order/booking`
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`；`X-Bytedance-Logid` 保存为预约单的 `create_log_id`。
- 仅接收 `biz_type=2012`；`source_order_id` 必须是本系统中已支付的 `biz_type=2011` 抖音预售券订单号。
- 必填校验：`order_id`、`source_order_id`、`hotel_id`、`rate_plan_id`、`room_id`、入住离店日期、入住间数、入住人数、`total_amount`、`daily_rates`。单日单间原始金额之和乘以间数必须等于 `total_amount`。
- `daily_rates[].daily_add_amount` 为可选的每晚加价金额，单位分。后端汇总为 `add_amount`；有加价且创单未携带 `pay_info` 时，预约单标记为 `payment_status=PENDING`，等待支付通知或超时取消。无加价为 `NOT_REQUIRED`，携带 `pay_info` 为 `PAID`。
- 同一抖音 `order_id` 重复回调返回同一个 `order_out_id`，不重复占房；确认未成功时会重新触发异步确认接单。
- 成功响应包含 `order_out_id`、`hotel_confirm_number` 和 `confirm_mode=2`。本地预约先标记为 `PENDING`；自动接单模式随后调用确认接单接口，人工模式保留待处理。接单成功为 `CONFIRMED`，拒单成功为 `REJECTED`，接口失败为 `FAILED` 并保留抖音响应 `logid`。
- 首次尚未保存后台设置时，`DOUYIN_AUTO_CONFIRM_ENABLED` 未配置或为 `true` 时自动确认接单。员工保存“抖音支持设置”后，数据库中的设置立即生效；关闭时预约单保留 `PENDING` 状态，等待人工处理。

## 手动接单与拒单

- 列表：`GET /api/douyin/presale-orders/bookings`
- 操作：`POST /api/douyin/presale-orders/bookings/:orderId/confirmation`
- 请求体：接单为 `{ "confirmResult": 1 }`；拒单为 `{ "confirmResult": 2, "rejectCode": 1, "rejectReason": "库存不足" }`。
- 仅在“抖音支持设置”关闭自动接单时允许调用；后端再次校验，前端按钮禁用不作为业务保障。
- 手动接单前后端会重验 `assigned_rooms`。任一房间已维修、关闭或不存在时返回 `409` 和 `BOOKING_ROOM_UNAVAILABLE`，不调用抖音确认接单接口；员工可恢复房态后重试，或改为拒单。
- 仅处理 `biz_type=2012` 预约订单。接单成功写入 `CONFIRMED`，拒单成功写入 `REJECTED` 并在同一事务释放本地未入住占房；接口失败写入 `FAILED`，同时保存抖音响应 `logid`、错误与拒单信息供重试排查。

## 确认接单接口边界

- 官方文档：[确认接单接口（预售券）](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/order-confirmation-api)、[确认接单接口（日历房）](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-house-trade/confirm-order-api)；两者使用相同的确认地址和请求契约。
- `biz_type=2011` 是预售券购买主订单；即使创单请求携带 `pay_info`，本系统也只保存为 `PAID` 并成功 ACK，不能调用确认接单接口。
- 确认接单仅适用于后续创建预约产生的 `biz_type=2012` 预约订单；该订单的 `order_id` 由创建预约订单接口返回。系统只会将该预约订单发送到确认接单接口，不会把 2011 订单误发出去。

## 入住/离店状态同步

- 官方文档：[订单入住审核接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/check-in-out-sync/order-check-in-audit)；后端调用 `POST /goodlife/v1/trip/trade/hotel/booking/audit/notify/`，通知抖音预约订单实际履约状态。
- 仅 `biz_type=2012` 的预约订单可同步：抖音 `order_id` 取 `douyin_presale_booking_orders.ota_order_id`，三方 `order_out_id` 取同表 `order_id`，不会把 `2011` 预售券主订单或普通前台订单发给抖音。
- 本地办理入住事务提交后异步发送 `accommodation_status=1`；正常或提前退房提交为已离店后异步发送 `accommodation_status=3`。网络或抖音业务失败不回滚本地订单、账单和房态。
- 办理入住会在同一事务内锁定该订单全部预留房间。任一房间维修、关闭或不存在时返回 `409` 和 `CHECK_IN_ROOM_UNAVAILABLE`，整笔入住回滚，不生成账单、不改订单和房态，也不发送入住履约通知。
- 每种状态的请求结果保存到 `douyin_presale_booking_accommodation_syncs`，包括重试次数、抖音 `extra.logid`、错误码、错误原因和原始响应；HTTP 200 仍会校验 `extra.error_code`。
- 后台可调用 `POST /api/douyin/presale-orders/:orderId/accommodation-sync/:status/retry` 重试，`:status` 仅接受 `1`（已入住）或 `3`（已离店）。成功记录幂等返回，不重复发送。

## 取消订单 SPI

- 回调地址：`POST /douyin/spi/order/cancel`
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`。
- 处理 `biz_type=2011` 的预售券主订单，以及 `biz_type=2012` 的预约订单；日历房 `2021` 仍同步返回拒绝，不能伪造取消成功。
- 使用 `order_id` 主定位对应业务订单，`order_out_id` 作为辅助定位；两者同时存在但指向不同订单时拒绝处理。
- 相同 `cancel_id` 重复回调按已处理结果返回，避免重复变更订单状态。
- `after_sale_type=1` 时，`CREATED`、`PAID` 和已取消订单可同步同意取消，订单阶段写为 `CANCELLED`。
- `2011` 的 `after_sale_type=3` 仅退款同步同意，但不改变订单阶段；取消状态写为 `REFUND_PENDING`，等待退款结果通知确认。`2012` 的仅退款不释放预约占房，仍由退款结果通知推进。
- `2012` 的 `after_sale_type=1/2` 会以 `cancel_id` 幂等标记预约为 `CANCELLED`，将待支付加价状态更新为 `CANCELLED`，并释放尚未入住的本地占房；用于用户预约加价后未支付超时的取消场景。
- 请求 logid 和原始请求体分别持久化到对应订单的取消字段。

## 人工取消审核

- 当取消 SPI 的 `need_audit=true` 时，`POST /douyin/spi/order/cancel` 不直接变更订单，写入 `douyin_presale_cancel_audits` 并返回 `cancel_mode=2`。
- 后台员工通过 `GET /api/douyin/presale-orders/cancel-audits?status=PENDING` 查看申请，再调用 `POST /api/douyin/presale-orders/cancel-audits/:cancelId/decision`，请求体为 `{ "cancelResult": 1|2, "reason": "" }`；拒绝时 `reason` 必填。
- 后端使用 `cancel_Id`（官方字段大小写）调用 `/goodlife/v1/trip/trade/hotel/cancel/audit/` 回传结论。回传成功后才完成本地状态流转；抖音响应 `extra.logid`、完整响应和失败原因都保存到审核记录，可用同一结论重试失败回传。
- `biz_type=2011` 只处理预售券主订单的取消/退款状态；`biz_type=2012` 的同意取消会释放未入住的预约占房。日历房 `2021` 仍不在本模块范围内。

## 退款结果通知 SPI

- 回调地址：`POST /douyin/spi/presale-order/refund-result`
- 官方文档：[订单退款结果通知 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/hotel-refund-result)
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`。
- 当前处理 `biz_type=2011` 的预售券与 `2012` 的预约单退款结果；请求须为 `refund_type=11/12/21/22`。日历房 `2021` 不进入本回调地址。
- `refund_total_amount`、`refund_amount`、`user_refund_amount` 全部按整数分保存。`refund_order_detail` 原样留存，以支持同一订单的多次部分退款。
- 每次通知写入 `douyin_presale_refund_notifications`；按规范化请求体 SHA-256 幂等，重复投递不会重复推进订单状态。
- 匹配到预售券主订单时，`refund_status` 更新为 `COMPLETED`；匹配到预约单时也记录退款完成，且仅 `refund_type=11/21` 整单退款会将预约状态更新为 `REFUNDED` 并释放尚未入住的本地占房。未匹配或订单标识冲突时仍保存通知并成功响应，供后续排查。
- 抖音已完成退款后才发起本通知，因此验签通过后无论本地匹配结果如何，接口都返回 `error_code=0`，不以业务错误影响退款结果。
- 请求 `X-Bytedance-Logid` 同时保存到通知明细和订单最新退款排障字段；运行日志只记录订单标识、金额和 logid，不记录退款原因或间夜明细。

## 联调前置

- 抖音应用已开通预售券交易逆向权限。
- 回调地址必须是抖音可访问的公网 HTTPS 地址。
- 发布前先执行 `npm run db:migrate`，再部署依赖取消和退款字段的后端代码。
