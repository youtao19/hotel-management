# 抖音价量态能力

## 房量房态主动推送

- 官方接口：[房量房态推送接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/housing-updates/room-status-api)
- 上游请求：`POST /goodlife/v1/trip/hotel/stock/save/`
- 权限：`life.capacity.trip_hotel_ari_pull`，日历房或酒店新预售券解决方案均需开通“房价/房态/房量更新”。

该接口按抖音 `rate_plan_id` 和入住日期推送：

- `available`：该日期是否可售；`false` 表示关房/停售。
- `inventory`：该日期可售房量。
- `timerange`：价格库存生效的自然日范围。

预售券场景应传其绑定的类型 13 预定商品 `rate_plan_id`，而非类型 12 预售券 `product_id`。单次最多 50 组 `aris`，建议按 7 天切分且不超过 30 天；HTTP 200 后仍须逐项检查 `data.save_result[].code`，并保留 `extra.logid`。

## 本地接口

`POST /api/rate-plans/:id/douyin/calendar-room/stock/sync`

手动计算并推送一个已同步套餐的房量房态：

```json
{
  "startDate": "2026-08-05",
  "endDate": "2026-08-11"
}
```

日期范围最多 30 天。成功响应返回抖音套餐 ID、实际提交的 `aris` 数量和 `logId`；失败响应返回 `douyin_log_id`。

## 自动同步边界

当前系统会在以下本地事务成功提交后，异步调用 `/goodlife/v1/trip/hotel/stock/save/`：

- 创建普通订单：推送该订单实际覆盖的房晚日期。
- 修改订单状态或换房：推送受影响房型的订单日期。
- 手动修改房间状态：推送该房型未来 30 个自然日。

自动推送失败不会回滚订单或房态变更；后端会记录失败原因和抖音 `logid`。提前退房、正常退房、订单改期尚未接入自动触发，可使用手动补推作为补偿。

已实现的相邻能力：

- `POST /api/douyin/ari-notify`：通知抖音主动拉取指定套餐和日期范围的价量态。
- `POST /douyin/spi/price-volume`：抖音回调本系统，读取按日价格、可售库存和可售状态。

后续若接入主动推送，应以订单、关房和房间维修状态变更为触发源；后端计算每个套餐每日的 `available`、`inventory` 后调用上游接口，成功才记录同步时间和 `logid`。
