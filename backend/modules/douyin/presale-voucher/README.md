# 抖音预售券联调说明

## 商品状态接口标识

已在 2026-08-05 的真实预售券同步日志中确认：`savepresale` 响应的 `pre_sale_coupon_id` 会保存到 `douyin_presale_vouchers.douyin_voucher_id`，其值可直接作为 `POST /goodlife/v1/trip/product/operate/` 的 `product_id_list` 项，用于该预售券的上架、下架等商品状态操作。

抖音返回的 `logid` 应随同步结果保存；本次验证的抖音 `logid` 为 `20260805114819FD0778A987259BD60424`。

## 商品上下架接口

`PATCH /api/douyin/presale-vouchers/:id/product-status`

仅允许已成功同步、且存在 `douyin_voucher_id` 的预售券调用。后端使用该字段作为抖音 `product_id_list`，调用 `POST /goodlife/v1/trip/product/operate/`。

```json
{
  "operation": "ONLINE"
}
```

- `ONLINE`：上架，映射抖音 `op_type=1`。
- `OFFLINE`：下架，映射抖音 `op_type=2`。
- 本期不开放删除、封禁等不可逆或需额外运营规则确认的操作。
- 成功时更新 `product_status`、`product_status_updated_at` 与 `last_product_status_log_id`；失败时保留 `last_product_status_log_id`、`last_product_status_error`，并在接口响应返回 `douyin_log_id`。

## 预售券按日房价推送

官方[房价推送接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/housing-updates/house-price-interface)的权限说明覆盖“酒店新预售券解决方案”。本系统复用日历房价维护入口：

- `PUT /api/rate-plans/:id/douyin/calendar-room/prices`：保存预售券套餐按入住日期的价格。
- `POST /api/rate-plans/:id/douyin/calendar-room/prices/sync`：调用 `POST /goodlife/v1/trip/hotel/price/save/` 推送价格。

预售券必须先存在已同步的类型 13 预定商品映射；后端从 `ota_channel_mappings.channel_item_id` 读取该 `rate_plan_id` 并写入 `aris[]`。该功能不调用预售券商品状态接口，也不使用或修改类型 12 的 `douyin_voucher_id`、券面售价。详细参数和日期范围限制见 [日历房价格模块说明](../calendar-room/README.md)。

## 预售券绑定预定商品排查记录

2026-08-05 抖音官方测试返回：`商品类型(实际值:预售券(12))`，但预售券 `bind_rate_plans` 仅接受 `预售房型/预定(13)`。本地预售券 1 绑定套餐 6 时，当前 `ota_channel_mappings.channel_item_id=1872219399969818` 被抖音识别为类型 12，不能继续作为 `bind_rate_plans` 传入。

处理方式是重新通过“创建/更新预定商品”链路取得类型 13 的抖音预定商品 ID，再覆盖该套餐的渠道映射后重新提交预售券；不能把已创建的预售券 `pre_sale_coupon_id` 回填到套餐映射中。

### 重建接口

`POST /api/rate-plans/:id/douyin/sync`

```json
{
  "rebuild": true
}
```

仅 `PRESALE` 套餐可用。重建请求不会在抖音请求中传旧 `rate_plan_id`，并使用稳定的新外部 ID `booking-<套餐ID>-v2`，避免抖音按旧 `out_rate_plan_id` 做幂等更新；抖音成功返回新的预定商品 ID 后，后端才覆盖 `ota_channel_mappings.channel_item_id`，并在 `channel_config.rebuild_from_rate_plan_id` 留存旧映射 ID。请求失败时旧映射保持不变。

## 酒店类目

创建/更新预售券请求固定发送 `presale_info.category_id=8001001`（经济型酒店）。

该值来自抖音酒店类目枚举；并已核对本地已同步的抖音物理房型，现有房型的 `raw_payload.category_id` 均为 `8001001`。预售券与绑定的抖音预定商品应保持同一酒店类目，不能使用通用类目 `101`。

若酒店在抖音侧改为其他酒店类型，应先同步对应物理房型并确认其类目，再统一调整此值，避免预售券和已上架酒店商品类目不一致。
