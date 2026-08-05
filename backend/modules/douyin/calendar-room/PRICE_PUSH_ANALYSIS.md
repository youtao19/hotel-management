# 抖音日历房房价推送分析

## 官方接口

- [房价推送接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/housing-updates/house-price-interface)
- 上游请求：`POST /goodlife/v1/trip/hotel/price/save/`
- 权限：`life.capacity.trip_hotel_ari_pull`

接口由本系统主动推送 `aris[]`。每组包含抖音 `rate_plan_id`、`timerange` 和价格；单次最多 50 组，建议按 7 天切分，日期范围不超过 30 天。抖音会异步提交，必须按 `data.save_result[]` 逐项判断是否成功，并保留 `extra.logid`。

## 实施结果

系统已调用 `/goodlife/v1/trip/hotel/price/save/`，支持主动推送日历房和预售券绑定预定商品的按日价格。预售券只使用已同步的类型 13 `rate_plan_id`，不使用类型 12 预售券 `product_id`，也不修改券面售价。

现有 `availability/` 模块提供的是不同方向的能力：

1. `POST /api/douyin/ari/notify`：通知抖音主动拉取价量态。
2. `POST /douyin/spi/price-volume`：抖音调用本系统，读取价格、房量和房态。

日历房价格已独立保存为“套餐 + 日期”的价格表，可表达周末价、节假日价和某天特价。

## 已选择的业务方案

### 方案：维护真正的按日价格

新增一张日历房价格表，例如 `douyin_calendar_room_prices`：

- `rate_plan_id`：本地套餐 ID。
- `stay_date`：房晚日期，`DATE`，按 `YYYY-MM-DD` 使用。
- `original_amount`：实际房价，单位元；调用抖音时转为分。
- 可选 `retail_amount`：划线价，单位元。
- 以 `(rate_plan_id, stay_date)` 唯一约束，防止同一天存在两条价格。

该方案已实现日历价格维护页面、数据库迁移和主动推送。

## 推荐实现结构

所有新代码放在 `backend/modules/douyin/calendar-room/`；预售券房价推送仅复用其已保存的套餐映射，不调用预售券商品接口。

```text
calendar-room/
├─ calendarPrice.repository.js   读取日历价格和抖音套餐映射
├─ calendarPrice.validator.js    校验套餐、日期、金额和单次上限
├─ calendarPrice.service.js      组装 aris 并调用 /price/save/
└─ calendarPrice.routes.js       提供本地价格维护和主动推送接口
```

已提供本地接口：

1. `PUT /api/rate-plans/:id/douyin/calendar-room/prices`：保存一个或多个日期的价格。
2. `GET /api/rate-plans/:id/douyin/calendar-room/prices?startDate=&endDate=`：查询价格日历。
3. `POST /api/rate-plans/:id/douyin/calendar-room/prices/sync`：向抖音主动推送指定日期范围。

## 后端同步流程

1. 校验套餐为 `CALENDAR_ROOM`，并且已存在日历房的抖音 `rate_plan_id` 映射。
2. 校验日期是自然日字符串、开始不晚于结束、单次不超过 30 天；服务内部按最多 7 天分批。
3. 从日历价格表读取每一天的价格；缺少价格时拒绝同步，不能擅自用 `base_price` 补齐。
4. 将元转换为分，合并相同价格的连续日期；每次请求最多发送 50 组 `aris`。
5. 调用上游接口，记录并打印 `logid`。
6. 逐项检查 `save_result[].code`；成功项记录同步时间，失败项返回原始错误和 `logid`，不标记为已同步。

## 前端调整

在售卖套餐的日历房编辑区增加“日历房价”入口：

- 日期区间和按天价格表。
- 批量设置同一价格，允许覆盖选中日期。
- 价格保存后才能点击“推送房价”。
- 页面只提示缺失价格和加载状态；是否允许推送由后端裁决。

## 测试与联调

1. 测试日历价保存、重复日期覆盖、金额校验和日期范围校验。
2. 测试预售券套餐、未同步日历房套餐、缺价套餐都不能推送。
3. Mock 上游接口，断言 `rate_plan_id`、日期、金额分单位、50 组上限、`save_result` 逐项失败和 `logid`。
4. 前端构建通过后，用已授权的日历房账号、真实物理房型和后端日志完成真实联调。
