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

## 创建预售订单 SPI

官方[创建预售订单 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-pre-sale-order)由抖音调用第三方，不是酒店主动创建订单。抖音支付或下单后会携带 `order_id`、`pre_sale_coupon_id`、券数量、金额、联系人和预约相关字段，请求头包含 `X-Bytedance-Logid`、`x-life-clientkey`、`X-life-sign`。

接入时必须按抖音 `order_id` 做创单幂等：抖音超时会重试；若订单已创建，仍须返回成功和原 `order_out_id`。官方将 `contact_info.phone` 定义为选填，因此未传电话时允许创单；实际传入电话时，字段可能为加密值，需要按官方旧版本地 AES-256-CBC 规则解密后再保存：`client_secret` 对齐到 32 位后作为 Key，右侧 16 位作为 IV，密文先 Base64 解码并按 PKCS5Padding 解密。系统兼容明文手机号、带 `+86` 区号、加密后得到的 JSON 字符串或对象。成功响应 `data.error_code=0`、回传抖音 `order_id` 与本地 `order_out_id`。

本地解密仅适用于不带 `Enc.` 前缀的旧版密文；若抖音回调给出 `Enc.` 前缀，官方要求改用在线解密接口，当前接口会以错误码 6 明确拒绝，避免以错误算法保存联系人数据。解密过程仅在后端执行，日志不输出密文或手机号明文。

创单排障日志的 `contactPhoneMode` 仅记录算法选择，不含联系人数据：`ONLINE_ENC` 表示 `Enc.` 前缀、必须在线解密；`LOCAL_OR_PLAIN` 表示可使用本地旧版 AES 规则或明文示例；`MISSING` 表示回调未携带电话字段。

本系统入口为 `POST /douyin/spi/presale-order/create`。后端复用 `x-life-sign` 验签，按 `ota_order_id=order_id` 幂等；重复请求返回已创建的本地 `order_id`。日志只保留订单号、券 ID、金额和 `X-Bytedance-Logid`，不记录联系人明文。

## 支付结果通知 SPI

官方[支付结果通知 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/paynotice)与创单 SPI 是两个独立回调，不能配置为同一个地址。本系统支付通知入口为 `POST /douyin/spi/presale-order/payment-notice`。

该接口仅接收 `biz_type=2011` 的预售券支付通知，验签后始终按预售券“无需接单”的规则处理。请求能匹配到本地订单时，后端将订单阶段更新为 `PAID`，保存本次 `X-Bytedance-Logid` 和支付通知数据；同一订单重复通知只重复确认，不会新建订单。未匹配到本地订单时保留排障日志并返回成功确认，避免抖音因支付通知重试阻塞。

抖音后台应分别配置：

- “抖音侧调用酒店系统方创建预售订单” → `/douyin/spi/presale-order/create`
- “抖音侧将客人创建订单的信息同步给酒店方” → `/douyin/spi/presale-order/payment-notice`

## 预售订单后台查看

`GET /api/douyin/presale-orders` 返回已由创单 SPI 写入的预售券主订单。该列表仅用于查看已购买的券订单，不会创建普通入住订单，也不会占用房间库存；无预约日期的订单应等待后续预约单再进入入住订单流程。

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
