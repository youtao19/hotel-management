# 抖音 OTA 官方文档索引

> 更新时间：2026-04-23
> 
> 说明：
> - 本文件用于沉淀用户已提供的抖音 OTA 官方文档链接，后续开发优先从这里查阅；
> - “当前代码关联”基于当前仓库实现状态整理，后续接入更多能力时可继续补充；
> - 所有链接均来自抖音开放平台官方文档。
> - 当前历史后端 `/api/douyin/*` 路由已停用，原 `backend/routes/douyin/douyinApi.js` 已删除；新的外部接收入口见 `POST /douyin/webhooks`、`POST /douyin/spi/price-volume` 与 `POST /douyin/spi/bookable`。

## 1. 接入前准备

### 1.1 OpenAPI接口调用约定
- 链接：[OpenAPI接口调用约定](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/openapiinterfacecallconvention)
- 用途：定义 OpenAPI 的通用调用方式、请求约束、认证头和调用流程，是后续所有 OpenAPI 请求的基础规范。
- 当前代码关联：`backend/modules/douyin/token/token.service.js`；具体 OpenAPI 调用目前由 `backend/modules/douyin/presale-product/product.service.js`、`backend/modules/douyin/availability/ariNotify.service.js` 和 `backend/modules/douyin/physical-room/physicalRoom.service.js` 直接发起。

### 1.2 生成 client-token
- 链接：[生成 client-token](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/client_token)
- 用途：说明如何获取调用抖音 OpenAPI 所需的 `client-token/client access-token`。
- 当前代码关联：`backend/modules/douyin/token/token.service.js`

### 1.3 消息推送配置接入
- 链接：[消息推送配置接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/message-push-configuration-access)
- 用途：说明如何在抖音开放平台配置消息推送地址、订阅推送能力和接入注意事项。
- 当前代码关联：待系统化接入，可作为回调配置排查依据。

### 1.4 SPI 接入
- 链接：[SPI 接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/spi)
- 用途：说明 SPI 接口的整体接入模式、回调处理要求和平台调用约束。
- 当前代码关联：历史资料，`/api/douyin/*` 路由已停用；当前可订检查和价量 SPI 入口见 `backend/modules/douyin/external/external.routes.js`。

### 1.5 WebHooks接入
- 链接：[WebHooks接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/webhooks)
- 用途：说明 Webhook 推送模式的接入流程、配置方式和验签处理思路。
- 当前代码关联：`backend/modules/douyin/external/external.routes.js`、`backend/modules/douyin/external/webhook.service.js`、`backend/modules/douyin/external/signature.service.js`
- 本地实现入口：`POST /douyin/webhooks`
- 当前实现范围：Webhook 验签、`verify_webhook` challenge 回执、`Msg-Id` Redis TTL 去重、双层 `content` 解析和结构化日志；具体业务事件状态流转后续按事件补齐。

### 1.6 SPI签名规则
- 链接：[SPI签名规则](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/spi-signature-rules)
- 用途：定义 SPI 请求签名串拼接方式、签名校验规则和安全要求。
- 当前代码关联：`backend/modules/douyin/external/signature.service.js`
- 注意：Webhook 使用 `X-Douyin-Signature` + SHA1；SPI 使用 `x-life-sign` + SHA-256，两者不能混用。

### 1.7 平台返回状态码
- 链接：[平台返回状态码](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/returns-a-status-code)
- 用途：说明抖音开放平台通用返回状态码、错误码含义与处理建议。
- 当前代码关联：当前错误响应分散在 `backend/modules/douyin/room-type-mapping/roomTypeMapping.controller.js` 和 `backend/modules/douyin/rate-plan/*.service.js`。

### 1.8 加密字段解密方法
- 链接：[加密字段解密方法](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/decrypt)
- 用途：说明敏感字段的解密算法、参数要求和落地解密流程。
- 当前代码关联：当前未实现抖音加密字段解密。

### 1.9 通用参数
- 链接：[通用参数](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/common-params)
- 用途：整理抖音开放平台接口的通用请求参数、公共字段和头部要求。
- 当前代码关联：当前未抽统一 OpenAPI client，具体调用见 `backend/modules/douyin/rate-plan/` 和 `backend/modules/douyin/physical-room/`。

### 1.10 OpenAPI SDK 总览
- 链接：[OpenAPI SDK 总览](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/sdk-overview)
- 用途：官方统一 SDK 说明，包含 Java / NodeJS / Go 三种语言的包引入与调用示例。
- 当前代码关联：当前项目为 Node.js 后端，可作为后续 SDK 化改造参考；当前未抽统一 OpenAPI client。
- 项目内沉淀文档：`docs/抖音OpenAPI_SDK接入文档.md`

## 2. API接口

### 2.1 酒店通用错误码
- 链接：[酒店通用错误码](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/general-error-codes)
- 用途：整理酒店行业接口共用错误码，便于统一做错误翻译、重试判断和日志告警。
- 当前代码关联：待补充到抖音模块统一错误映射。

### 2.2 酒店日历房常见枚举列表
- 链接：[酒店日历房常见枚举列表](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/enum-list)
- 用途：汇总匹配状态、取消规则、附餐类型、酒店类目、图片类型等核心枚举。
- 当前代码关联：房型同步、酒店静态信息、订单交易字段映射都应参考本页枚举值。

## 3. 日历房交易正向

### 3.1 确认接单接口
- 链接：[确认接单接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-house-trade/confirm-order-api)
- 用途：在抖音侧支付成功后，三方需在约定时限内回传接单结果，可接单或拒单。
- 当前代码关联：当前未实现抖音确认接单接口。

### 3.2 酒店创建订单
- 链接：[酒店创建订单](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-house-trade/hotel-booking)
- 用途：定义抖音向三方推送日历房订单创建时的回调字段、业务语义和订单主流程。
- 当前代码关联：当前未实现抖音酒店创建订单 SPI。

## 4. 日历房交易逆向

### 4.1 酒店取消订单SPI
- 链接：[酒店取消订单SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/hotel-order-cancel)
- 用途：定义抖音发起取消订单/逆向交易时，三方需要承接的 SPI 请求格式和处理要求。
- 当前代码关联：当前未实现，后续取消订单链路应优先参考此文档。

### 4.2 售后审核结果返回
- 链接：[售后审核结果返回](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/order-cancellation-api)
- 用途：用于三方向抖音回传逆向售后审核结果、同意/拒绝取消等处理结果。
- 当前代码关联：当前未实现，需与“酒店取消订单SPI”配套接入。

### 4.3 通知退款结果
- 链接：[通知退款结果](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/refund-result-api)
- 用途：用于接收或回传退款结果，是退款逆向闭环的重要一环。
- 当前代码关联：当前未实现抖音退款结果通知。

## 5. 房型与静态信息

### 5.1 售卖房型静态信息接口
- 链接：[售卖房型静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/house-type-update/static-room-info-api)
- 用途：定义售卖房型的静态信息创建、更新或匹配所需字段。
- 当前代码关联：当前未实现日历房售卖房型静态信息接口；本地售卖套餐同步抖音预售券见 `backend/modules/douyin/presale-product/product.service.js`。

### 5.2 物理房型静态信息接口
- 链接：[物理房型静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/room-info-ops/room-static-info-api)
- 用途：用于创建或更新抖音物理房型静态信息，是“创建物理房型”验收项的核心 OpenAPI。
- 当前代码关联：当前未实现抖音物理房型创建/更新接口；已实现物理房型查询和缓存刷新，见 `backend/modules/douyin/physical-room/physicalRoom.service.js`。

### 5.3 物理房型静态信息查询
- 链接：[物理房型静态信息查询](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/room-info-access/room-static-info-query)
- 用途：查询抖音侧物理房型静态信息，是物理房型同步和匹配的基础接口。
- 当前代码关联：`backend/modules/douyin/physical-room/physicalRoom.service.js`、`backend/modules/douyin/physical-room/physicalRoom.repository.js`

### 5.4 自助匹配物理房型信息查询接口
- 链接：[自助匹配物理房型信息查询接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/room-info-access/room-info-query-api)
- 用途：用于查询或拉取可自助匹配的物理房型信息，辅助本地房型与抖音房型建立映射。
- 当前代码关联：`backend/modules/douyin/room-type-mapping/roomTypeMapping.repository.js`

## 6. 订单履约状态

### 6.1 入住/离店状态同步能力
- 链接：[入住/离店状态同步能力](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/check-in-out-sync/order-check-in-audit)
- 用途：定义订单入住、离店、核销等履约状态向抖音同步的接口能力与字段要求。
- 当前代码关联：当前未实现抖音履约状态同步。

## 6.2 房价/房态/房量更新

### 6.2.1 日历房价库变更增量通知接口
- 链接：[日历房价库变更增量通知接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/housing-updates/price-change-notification)
- 用途：当酒店侧价格或库存变化时，通知抖音触发价量态拉取。
- 当前代码关联：`backend/modules/douyin/availability/ariNotify.service.js`、`backend/modules/douyin/availability/ariNotify.routes.js`
- 本地实现入口：`POST /api/douyin/ari-notify`
- 当前会一并发送 `hotel_ids`，优先取套餐渠道映射中的 `hotel_id/poi_id`，不足时回退到抖音物理房型缓存。
- 当前默认会发送 `notify_scene: [1, 2, 3, 4]`，覆盖价格、库存、房态、日历属性四类变更场景。

### 6.2.2 房量房态推送接口
- 链接：[房量房态推送接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/housing-update/room-status-push-api)
- 用途：主动向抖音推送指定售卖房型和日期的房量与房态。
- 当前代码关联：当前未实现主动房态推送；已实现“日历房价库变更增量通知”触发抖音拉取，见 `backend/modules/douyin/availability/ariNotify.service.js`。

### 6.2.3 房价推送接口
- 链接：[房价推送接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/housing-updates/house-price-interface)
- 用途：主动向抖音推送指定售卖房型和日期的房价。
- 当前代码关联：当前未实现主动房价推送；已实现“日历房价库变更增量通知”触发抖音拉取，见 `backend/modules/douyin/availability/ariNotify.service.js`。

## 7. 酒店静态信息匹配/创建/更新能力

### 7.0 自助匹配酒店信息查询接口（模式二）
- 链接：[自助匹配酒店信息查询接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-info-fetch/hotel-info-query)
- 用途：模式二核心接口。由合作方主动查询可匹配酒店信息，用于本地建立酒店与房型 mapping。
- 当前代码关联：历史资料，`/api/douyin/*` 路由已停用；原计划接口 `POST /api/douyin/hotel-info/query`、`POST /api/douyin/hotel-info/sync` 当前不可用。

### 7.1 酒店静态信息接口
- 链接：[酒店静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-api)
- 用途：用于酒店基础静态信息的提交、匹配、创建和更新。
- 当前代码关联：当前主链路采用模式二（自助匹配），本接口暂未接入。

### 7.2 酒店静态信息处理状态查询
- 链接：[酒店静态信息处理状态查询](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-status)
- 用途：查询酒店静态信息处理进度、审核结果和失败原因。
- 当前代码关联：当前未实现，后续静态信息提交后需要接入轮询或后台查询。

### 7.3 酒店静态信息处理结果推送Webhook
- 链接：[酒店静态信息处理结果推送Webhook](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-push)
- 用途：接收酒店静态信息处理结果的异步推送，适合替代或补充状态轮询。
- 当前代码关联：历史资料，`/api/douyin/*` 路由已停用；后续重建 Webhook 时可参考本节接口语义。

## 8. 住宿预售券交易

### 8.1 预售券交易正向

#### 8.1.1 正向交易流程
- 链接：[正向交易流程](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/hoteltradedesc)
- 用途：说明酒店住宿预售券从可订检查、支付、创单、预约到接单的整体流程，是预售券建模和链路拆分的总纲。
- 当前代码关联：预售券创单 SPI、后续预约单与支付通知能力均应参考本页流程。

#### 8.1.2 可订检查 SPI
- 链接：[可订检查 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/bookable-check)
- 用途：在预售券场景下由抖音向三方发起可订检查，确认当前商品是否可售。
- 当前代码关联：`backend/modules/douyin/external/external.routes.js`、`backend/modules/douyin/availability/bookableCheck.service.js`、`backend/modules/douyin/external/signature.service.js`
- 本地实现入口：`POST /douyin/spi/bookable`
- 抖音后台配置 URL：`https://<你的公网域名>/douyin/spi/bookable`
- 当前支持范围：预售券 `biz_type=2011`；失败时返回 `data.ari.stock_and_amount[]`，字段包含 `room_id`、`rate_plan_id`、`timerange`、`original_amount`、`available`、`inventory`。

#### 8.1.3 支付结果通知 SPI
- 链接：[支付结果通知 spi](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/paynotice)
- 用途：用于预售券支付成功后的异步通知，文档中区分一步创单和两步创单模式。
- 当前代码关联：当前未实现，后续预售券支付状态同步和自动履约需要接入。

#### 8.1.4 确认接单接口
- 链接：[确认接单接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/order-confirmation-api)
- 用途：用于预售券场景下回传接单结果。
- 当前代码关联：当前未实现，后续预售券接单结果回传需要接入。

#### 8.1.5 创建预售订单 SPI
- 链接：[创建预售订单 SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-pre-sale-order)
- 用途：定义抖音向三方创建住宿预售券订单时的回调字段和成功响应。
- 当前代码关联：当前未实现预售订单创建 SPI；预售券可订检查见 `backend/modules/douyin/availability/bookableCheck.service.js`。

#### 8.1.6 创建预约
- 链接：[创建预约](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/create-booking-order)
- 用途：用于将预售券订单进一步落实为预约单，是 `biz_type=2012` 的核心接口。
- 当前代码关联：当前未实现，后续应作为预售券落地到实际入住订单的桥梁。

#### 8.1.7 酒店预约修改订单
- 链接：[酒店预约修改订单](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/accommodation-voucher-trade/hotel-modify-order)
- 用途：用于修改预售券对应的预约单信息。
- 当前代码关联：当前未实现，后续预约单变更时接入。

### 8.2 住宿预售券创建和更新

#### 8.2.1 创建/更新预定商品
- 链接：[创建/更新预定商品](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-voucher-mgmt/create-update-products)
- 用途：用于创建或更新住宿预售券关联的预定商品，是预售券商品化配置的基础能力。
- 当前代码关联：`backend/database/postgreDB/tables/rate_plans.js`、`backend/modules/douyin/rate-plan/ratePlan.routes.js`、`backend/modules/douyin/presale-product/product.service.js`、`docs/OTA_接口文档.md`
- 字段映射：
  - `rate_plans.name` -> 抖音 `rate_plan_name`
  - `rate_plans.id` -> 抖音 `out_rate_plan_id`
  - `rate_plans.status` -> 抖音 `active`
  - `rate_plans.sales_type` -> 抖音 `sales_type`
  - `rate_plans.hourly_*` -> 抖音 `hourly_room_detail`
  - 抖音返回的 `rate_plan_id` 继续写入 `ota_channel_mappings.channel_item_id`

#### 8.2.2 创建/更新预售券
- 链接：[创建/更新预售券](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-voucher-mgmt/create-update-coupon)
- 用途：用于创建或更新住宿预售券主体信息，通常与预定商品、售卖规则和有效期配置配套使用。
- 当前代码关联：当前未实现，后续接入预售券主数据创建与更新时使用。

#### 8.2.3 预售券审核结果通知
- 链接：[预售券审核结果通知](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/hotel-voucher-mgmt/presale-ticket-review)
- 用途：用于接收抖音推送的预售券审核结果通知，可根据 `Msg-Id` 做消息去重，并根据审核结果更新本地预售券状态。
- 当前代码关联：当前未实现，后续接入预售券审核状态回调时使用。

### 8.3 预售券交易逆向

#### 8.3.1 售后审核结果返回
- 链接：[售后审核结果返回](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/callback-cancellation)
- 用途：用于向抖音回传预售券逆向退款审核结果。
- 当前代码关联：当前未实现，后续预售券逆向链路需接入。

#### 8.3.2 订单取消退款通知 SPI
- 链接：[订单取消退款通知SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/refund-notification)
- 用途：承接预售券退款通知和售后退款信息。
- 当前代码关联：当前未实现，后续预售券退款链路需接入。

#### 8.3.3 酒店取消订单 SPI
- 链接：[酒店取消订单SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/reverse-hotel-voucher/cancel-hotel-order)
- 用途：承接预售券订单取消通知，包含支付前取消、支付后取消、创单失败取消等场景。
- 当前代码关联：当前未实现，后续预售券取消逻辑需接入。

## 9. 主动拉取价量态

### 9.1 酒店日历房价量态拉取接口
- 链接：[酒店日历房价量态拉取接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/price-volume-pull/price-volume-interface)
- 用途：由抖音主动调用三方接口，拉取指定酒店、售卖房型和日期范围内的价格、房量、房态数据。
- 当前代码关联：`backend/modules/douyin/external/external.routes.js`、`backend/modules/douyin/availability/priceVolume.service.js`、`backend/modules/douyin/external/signature.service.js`
- 本地实现入口：`POST /douyin/spi/price-volume`
- 当前返回结构：`data.status` 与 `data.error_code` 同层，`data.room_rates[].rate_avail_infos[]` 按官方字段返回；价格由本地“元”转换为抖音要求的“分”，日期保持 `YYYY-MM-DD` 字符串。

### 9.2 预售券价量态拉取接口
- 链接：[价量态拉取接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/presale/pull-price-volume/price-volume-interface)
- 用途：由抖音主动调用三方接口，定时拉取指定酒店、售卖房型和日期范围内的价格、房量、房态数据，是预售券价量态保鲜的重要能力。
- 当前代码关联：历史规划资料；当前已实现的是酒店日历房入口 `POST /douyin/spi/price-volume`。

## 10. 当前最值得优先深读的文档

### 10.1 已经直接影响现有代码的文档
- `生成 client-token`
- `SPI 接入`
- `SPI签名规则`
- `酒店创建订单`
- `确认接单接口`
- `物理房型静态信息接口`
- `售卖房型静态信息接口`
- `物理房型静态信息查询`
- `创建预售订单 SPI`
- `正向交易流程`
- `价量态拉取接口`

### 10.2 下一阶段最可能马上用到的文档
- `创建/更新预定商品`
- `创建/更新预售券`
- `预售券审核结果通知`
- `价量态拉取接口`
- `酒店取消订单SPI`
- `售后审核结果返回`
- `入住/离店状态同步能力`
- `售卖房型静态信息接口`
- `酒店通用错误码`
- `酒店日历房常见枚举列表`
- `创建预约`
- `支付结果通知 spi`
