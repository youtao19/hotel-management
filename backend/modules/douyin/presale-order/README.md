# 预售券订单

## 取消订单 SPI

- 回调地址：`POST /douyin/spi/order/cancel`
- 鉴权：`x-life-clientkey` 和 `x-life-sign`，复用 `external/signature.service.js`。
- 当前只处理抖音请求体 `biz_type=2011` 的预售券订单；`2012` 和 `2021` 同步返回拒绝取消，不会被误判为已取消或进入异步自动同意。
- 使用 `order_id` 主定位预售券订单，`order_out_id` 作为辅助定位；两者同时存在但指向不同订单时拒绝处理。
- 相同 `cancel_id` 重复回调按已处理结果返回，避免重复变更订单状态。
- `after_sale_type=1` 时，`CREATED`、`PAID` 和已取消订单可同步同意取消，订单阶段写为 `CANCELLED`。
- `after_sale_type=3` 的仅退款暂不改变订单阶段，返回拒绝；后续由“订单取消退款通知 SPI”单独处理。
- 请求 logid 持久化到 `douyin_presale_orders.cancel_log_id`，完整请求体持久化到 `cancel_payload`。

## 联调前置

- 抖音应用已开通预售券交易逆向权限。
- 回调地址必须是抖音可访问的公网 HTTPS 地址。
- 发布前先执行 `npm run db:migrate`，再部署依赖取消字段的后端代码。
