# 抖音日历房售卖房型静态信息

## 官方依据

- [售卖房型静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/house-type-update/static-room-info-api)
- [酒店日历房常见枚举值列表](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/enum-list)
- 上游请求：`POST /goodlife/v1/trip/hotel/rateplan/save/`
- 所需权限：`life.capacity.trip_sale_room_pull`

## 模块边界

本目录只实现日历房业务，不引用预售券模块。一个本地套餐只能选择 `CALENDAR_ROOM` 或 `PRESALE`；存在抖音渠道映射后不能切换业务类型，也不能交叉调用两种同步接口。

## 本地接口

### 保存规则

`PUT /api/rate-plans/:id/douyin/calendar-room/rule`

仅日历房套餐可调用。规则独立保存，不写入预售券字段或 `douyin_config`。

```json
{
  "validityStart": "2026-08-05",
  "validityEnd": "2026-12-31",
  "cancelRule": 1,
  "breakfastNumber": 2,
  "refundType": 1,
  "status": 1
}
```

- `cancelRule`：`1` 免费取消，`2` 限时取消，`3` 不可取消。
- `breakfastNumber`：每间夜早餐数，`0` 表示不含早餐。
- `refundType`：`1` 可退款，`2` 不可退款。
- `status`：`1` 上架，`0` 下架。
- 有效期只接受真实的 `YYYY-MM-DD` 自然日字符串，不进行 UTC 或手动时区换算。

### 查询规则

`GET /api/rate-plans/:id/douyin/calendar-room/rule`

### 同步静态信息

`POST /api/rate-plans/:id/douyin/calendar-room/sync`

后端根据本地套餐、日历房规则和已匹配的抖音物理房型调用上游接口，并传递 `access-token` 与 `Rpc-Transit-Life-Account`。只有返回中匹配本地 `out_rate_plan_id` 的 `rate_plan_map[].code=0` 且带有 `rate_plan_id` 时，才写入渠道映射；HTTP 200 的单项失败仍返回失败，并附带 `douyin_log_id`。

### 保存按日价格

`PUT /api/rate-plans/:id/douyin/calendar-room/prices`

日历房和预售券套餐都可调用。价格按套餐和房晚日期保存，重复日期会覆盖原价格。预售券推送的是其已同步的类型 13 预定商品按日房价，不会修改类型 12 预售券的券面售价。

```json
{
  "prices": [
    { "stayDate": "2026-08-05", "originalAmount": 398, "retailAmount": 499 }
  ]
}
```

金额单位为元；`retailAmount` 可不传，传入时不能低于 `originalAmount`。

### 查询与推送按日价格

- `GET /api/rate-plans/:id/douyin/calendar-room/prices?startDate=2026-08-05&endDate=2026-08-11`
- `POST /api/rate-plans/:id/douyin/calendar-room/prices/sync`

推送请求体使用 `startDate`、`endDate` 和可选的 `accountId`。后端只推送已经保存的按日价格；范围内缺少任一天价格会拒绝推送。酒店 ID 固定读取 `DOUYIN_POI_ID`，未配置时不调用抖音。金额转换为分后调用 `/goodlife/v1/trip/hotel/price/save/`，每批最多 7 天，成功批次会记录同步时间和 `logid`。

抖音会先校验已同步的售卖房型信息。日历房修改“早餐数量”后，必须先点击套餐列表的“更新抖音日历房”，确认成功后才能推送房价；房价接口不能补充餐食信息。预售券必须先同步类型 13 预定商品，再推送其按日房价。失败时，前端和后端日志都会显示抖音 `logid`。

## 联调前置条件

1. 应用已获得日历房接口权限。
2. 本地房型已匹配到当前账号、酒店下的抖音物理房型。
3. 使用真实账号同步时，以后端日志中的 `douyin_log_id` 作为平台排查依据。
4. `dev.env` 已配置当前酒店的 `DOUYIN_POI_ID`。

## 实施记录

- 房价推送的分析与数据模型选择见 [PRICE_PUSH_ANALYSIS.md](PRICE_PUSH_ANALYSIS.md)。
