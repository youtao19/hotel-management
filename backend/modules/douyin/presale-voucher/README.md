# 抖音预售券联调说明

## 创建与更新规则

官方[创建/更新预售券接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-voucher-mgmt/create-update-coupon)的 `presale_info.out_id` 是三方预售券唯一标识，首次写入后不可修改。更新已创建的券时，必须在 `presale_info.pre_sale_coupon_id` 传入抖音预售券 ID，并提交完整券信息；仅重复传同一 `out_id` 会被视作新建，可能返回“该 out_id 已绑定其他商品”。

## 取消预约规则

`POST /api/douyin/presale-vouchers` 和 `PUT /api/douyin/presale-vouchers/:id` 接收 `cancelBookingType`。当前仅支持 `2`（限时取消）和 `3`（不可取消）：

- `3`：同步为 `cancel_booking_rule: { cancel_type: 3 }`。
- `2`：还必须传 `cancelBookingOffsetDays`（至少 1）和 `cancelBookingOffsetHours`（0 至 23）。后端固定按入住时间计算，组装 `cancel_time_type: 2` 与一条 `cancel_offset`，其中 `cut_type: 1`、`cut_value: 0` 表示顾客可在入住前指定时间免费取消，超过截止时间不可取消。

阶梯价取消（`4`）尚未实现，`1`（未使用自动退）不再接受或保存。

## 售卖时间默认值与校验

新增预售券前，前端调用 `GET /api/douyin/presale-vouchers/sale-time-default` 获取服务器按 `Asia/Shanghai` 计算的 `saleStartAt`。该值为当前北京时间加 2 分钟，格式为 `YYYY-MM-DD HH:mm`；前端据此屏蔽更早的日期和时间。

`POST /api/douyin/presale-vouchers` 会再次按服务器北京时间校验 `saleStartAt` 必须晚于当前时刻，避免浏览器时间偏差或用户停留过久后把过期售卖时间同步给抖音。更新已售卖的预售券不重复应用这条创建校验；创建和更新都要求 `saleEndAt` 晚于 `saleStartAt`。

## 本地券面图上传

`POST /api/douyin/presale-vouchers/images` 接收 multipart 字段 `images`，员工可从本机选择 JPG、PNG 或 WebP 图片。后端将文件保存到 `backend/modules/douyin/presale-voucher/uploads/`，并返回 `/uploads/presale-vouchers/:filename` 的完整公网 URL；该静态路径无需 JWT，供抖音审核服务拉取图片。

上传前须把 `dev.env` 的 `APP_URL` 设置为 ngrok 暴露后端服务端口后的公网 `http/https` 根地址，例如 `https://example.ngrok-free.app`。`localhost`、`127.0.0.1` 和非 HTTP(S) 地址会被拒绝，避免提交抖音无法访问的券面图。单张图片最大 5MB，一次最多 9 张。

## 购买上限

创建和更新预售券的 `POST /api/douyin/presale-vouchers`、`PUT /api/douyin/presale-vouchers/:id` 请求必须同时提供以下正整数，并由后端保存后同步到抖音 `trade_info.limt_buy_rule`：

- `eachPersonMax`：单个用户在该券售卖期内累计最多购买的张数。
- `eachPersonEachOrderMax`：单个用户每笔订单最多购买的张数。

两个字段默认值均为 `1`；已存在的预售券迁移后也会使用此默认值。

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

## 预约加价日期

预售券编辑弹窗可配置多条“预约加价日期”规则。每条规则包含：

- `amount`：每晚加价金额，单位元，必须大于 0；
- `startDate`、`endDate`：加价日期范围，必须落在该券的可预约日期内；
- `weekdays`：可选的星期数组，`1` 至 `7` 分别表示周一至周日；全选即日期范围内每天生效。

本地接口 `POST /api/douyin/presale-vouchers` 和 `PUT /api/douyin/presale-vouchers/:id` 使用 `markupRules` 传递规则，数据库保存为 `douyin_presale_vouchers.markup_rules`。同步时后端将金额转换为分，并在 `savepresale` 的 `presale_info.pre_sale_coupon_info` 中发送 `markup_type=1` 和 `markup_info[]`。

加价规则只影响用户后续预约时的应付加价，不改变预售券的券面售价。用户预约命中规则时，抖音会在创建预约 SPI 的 `daily_rates[].daily_add_amount` 下发每晚加价金额。

## 创建预售订单 SPI

官方[创建预售订单 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-pre-sale-order)由抖音调用第三方，不是酒店主动创建订单。请求会携带 `order_id`、`pre_sale_coupon_id`、券数量、金额、联系人和预约相关字段，请求头包含 `X-Bytedance-Logid`、`x-life-clientkey`、`X-life-sign`。

接入时必须按抖音 `order_id` 做创单幂等：抖音超时会重试；若订单已创建，仍须返回成功和原 `order_out_id`。官方将 `contact_info.phone` 定义为选填，因此未传电话时允许创单；实际传入电话时，字段可能为加密值，需要按官方旧版本地 AES-256-CBC 规则解密后再保存：`client_secret` 对齐到 32 位后作为 Key，右侧 16 位作为 IV，密文先 Base64 解码并按 PKCS5Padding 解密。系统兼容明文手机号、带 `+86` 区号、加密后得到的 JSON 字符串或对象。成功响应 `data.error_code=0`、回传抖音 `order_id` 与本地 `order_out_id`。

本地解密仅适用于不带 `Enc.` 前缀的旧版密文；若抖音回调给出 `Enc.` 前缀，官方要求改用在线解密接口，当前接口会以错误码 6 明确拒绝，避免以错误算法保存联系人数据。解密过程仅在后端执行，日志不输出密文或手机号明文。

创单排障日志的 `contactPhoneMode` 仅记录算法选择，不含联系人数据：`ONLINE_ENC` 表示 `Enc.` 前缀、必须在线解密；`LOCAL_OR_PLAIN` 表示可使用本地旧版 AES 规则或明文示例；`MISSING` 表示回调未携带电话字段。

本系统入口为 `POST /douyin/spi/presale-order/create`。后端复用 `x-life-sign` 验签，按 `ota_order_id=order_id` 幂等；重复请求返回已创建的本地 `order_id`。日志只保留订单号、券 ID、金额和 `X-Bytedance-Logid`，不记录联系人明文。

创单模式由抖音后台配置：支付后创单的请求会携带 `pay_info`，抖音不会再调用支付通知 SPI，后端直接将订单保存为 `PAID` 并在映射数据中保留支付时间；未携带 `pay_info` 的两步创单订单先保存为 `CREATED`，等待支付通知更新。

## 支付结果通知 SPI

官方[支付结果通知 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/paynotice)与创单 SPI 是两个独立回调，不能配置为同一个地址。本系统支付通知入口为 `POST /douyin/spi/presale-order/payment-notice`。

该接口接收未携带 `pay_info` 的两步创单支付通知。`biz_type=2011` 匹配预售券主订单后更新为 `PAID`；`biz_type=2012` 匹配存在加价的预约订单后更新其 `payment_status=PAID`，保存本次 `X-Bytedance-Logid` 和支付通知数据。同一订单重复通知只重复确认，不会新建订单。未匹配到本地订单时保留排障日志并返回成功确认，避免抖音因支付通知重试阻塞。

抖音后台应分别配置：

- “抖音侧调用酒店系统方创建预售订单” → `/douyin/spi/presale-order/create`
- “抖音侧将客人创建订单的信息同步给酒店方” → `/douyin/spi/presale-order/payment-notice`

## 预售订单后台查看

`GET /api/douyin/presale-orders` 返回已由创单 SPI 写入的预售券主订单。该列表仅用于查看已购买的券订单，不会创建普通入住订单，也不会占用房间库存；无预约日期的订单应等待后续预约单再进入入住订单流程。

## 酒店类目

创建/更新预售券请求固定发送 `presale_info.category_id=8001001`（经济型酒店）。

该值来自抖音酒店类目枚举；并已核对本地已同步的抖音物理房型，现有房型的 `raw_payload.category_id` 均为 `8001001`。预售券与绑定的抖音预定商品应保持同一酒店类目，不能使用通用类目 `101`。

若酒店在抖音侧改为其他酒店类型，应先同步对应物理房型并确认其类目，再统一调整此值，避免预售券和已上架酒店商品类目不一致。
