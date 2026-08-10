# 预售券订单

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
- 当前只处理 `biz_type=2011` 的预售券退款结果；请求须为 `refund_type=11/12/21/22`。日历房 `2021` 和预约单 `2012` 不会进入本回调地址。
- `refund_total_amount`、`refund_amount`、`user_refund_amount` 全部按整数分保存。`refund_order_detail` 原样留存，以支持同一订单的多次部分退款。
- 每次通知写入 `douyin_presale_refund_notifications`；按规范化请求体 SHA-256 幂等，重复投递不会重复推进订单状态。
- 匹配到预售券订单时，`refund_status` 从 `PENDING` 更新为 `COMPLETED`；未匹配或订单标识冲突时仍保存通知并成功响应，供后续排查。
- 抖音已完成退款后才发起本通知，因此验签通过后无论本地匹配结果如何，接口都返回 `error_code=0`，不以业务错误影响退款结果。
- 请求 `X-Bytedance-Logid` 同时保存到通知明细和订单最新退款排障字段；运行日志只记录订单标识、金额和 logid，不记录退款原因或间夜明细。

## 联调前置

- 抖音应用已开通预售券交易逆向权限。
- 回调地址必须是抖音可访问的公网 HTTPS 地址。
- 发布前先执行 `npm run db:migrate`，再部署依赖取消和退款字段的后端代码。
