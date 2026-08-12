# 抖音按日房价公共协议

本目录封装抖音 `POST /goodlife/v1/trip/hotel/price/save/` 的公共协议和可配置路由基础，不自行选择日历房或预售券业务；调用方必须传入并校验所属业务类型。

公共处理包括：

- 价格从元转换为分，合并连续同价日期；
- 单次最多 50 组 `aris`，按最多 7 个自然日分批，日期范围最多 30 天；
- 传递 `account_id`、`DOUYIN_POI_ID`、`access-token` 和 `Rpc-Transit-Life-Account`；
- 同时校验 `extra.error_code` 与目标 `data.save_result[].code`；
- 记录并回传抖音 `logid`，成功后标记对应日期已同步。

日历房和预售券各自在业务模块中校验套餐类型、选择自己的接口路径和日志类型。预售券仅可传其类型 13 预定商品的 `rate_plan_id`，不能传类型 12 预售券 `douyin_voucher_id`。
