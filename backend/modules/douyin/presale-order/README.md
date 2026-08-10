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
- 已实现：预约 SPI 始终返回 `confirm_mode=2`。响应发送后异步调用确认接单接口，确认请求和响应的 `logid`、失败原因及状态持久化到 `douyin_presale_booking_orders`。
- 尚待产品规则配置：可订检查和预约创单当前只校验入住人数为正数，尚未配置每房最大入住人数、会员校验、餐食、钟点房等额外限制。

## 创建预约 SPI

- 回调地址：`POST /douyin/spi/presale-order/booking`
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`；`X-Bytedance-Logid` 保存为预约单的 `create_log_id`。
- 仅接收 `biz_type=2012`；`source_order_id` 必须是本系统中已支付的 `biz_type=2011` 抖音预售券订单号。
- 必填校验：`order_id`、`source_order_id`、`hotel_id`、`rate_plan_id`、`room_id`、入住离店日期、入住间数、入住人数、`total_amount`、`daily_rates`。单日单间金额之和乘以间数必须等于 `total_amount`。
- 同一抖音 `order_id` 重复回调返回同一个 `order_out_id`，不重复占房；确认未成功时会重新触发异步确认接单。
- 成功响应包含 `order_out_id`、`hotel_confirm_number` 和 `confirm_mode=2`。本地预约先标记为 `PENDING`，随后调用抖音确认接单接口；成功为 `CONFIRMED`，失败为 `FAILED` 并保留抖音响应 `logid`。
- `DOUYIN_AUTO_CONFIRM_ENABLED` 未配置或为 `true` 时自动确认接单；仅在开发环境做“超时未接单”联调时设为 `false`，此时保留 `PENDING` 状态并记录 `confirm_skipped_for_timeout_test`，绝不能用于生产环境。

## 确认接单接口边界

- 官方文档：[确认接单接口（预售券）](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/order-confirmation-api)、[确认接单接口（日历房）](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-house-trade/confirm-order-api)；两者使用相同的确认地址和请求契约。
- `biz_type=2011` 是预售券购买主订单；即使创单请求携带 `pay_info`，本系统也只保存为 `PAID` 并成功 ACK，不能调用确认接单接口。
- 确认接单仅适用于后续创建预约产生的 `biz_type=2012` 预约订单；该订单的 `order_id` 由创建预约订单接口返回。系统只会将该预约订单发送到确认接单接口，不会把 2011 订单误发出去。

## 取消订单 SPI

- 回调地址：`POST /douyin/spi/order/cancel`
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`。
- 当前只处理抖音请求体 `biz_type=2011` 的预售券订单；`2012` 和 `2021` 同步返回拒绝取消，不会被误判为已取消或进入异步自动同意。
- 使用 `order_id` 主定位预售券订单，`order_out_id` 作为辅助定位；两者同时存在但指向不同订单时拒绝处理。
- 相同 `cancel_id` 重复回调按已处理结果返回，避免重复变更订单状态。
- `after_sale_type=1` 时，`CREATED`、`PAID` 和已取消订单可同步同意取消，订单阶段写为 `CANCELLED`。
- `after_sale_type=3` 的仅退款同步同意，但不改变订单阶段；取消状态写为 `REFUND_PENDING`，等待退款结果通知确认。
- 请求 logid 持久化到 `douyin_presale_orders.cancel_log_id`，完整请求体持久化到 `cancel_payload`。

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
