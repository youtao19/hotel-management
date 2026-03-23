# 抖音 OTA 官方文档索引

> 更新时间：2026-03-23
> 
> 说明：
> - 本文件用于沉淀用户已提供的抖音 OTA 官方文档链接，后续开发优先从这里查阅；
> - “当前代码关联”基于当前仓库实现状态整理，后续接入更多能力时可继续补充；
> - 所有链接均来自抖音开放平台官方文档。

## 1. 接入前准备

### 1.1 OpenAPI接口调用约定
- 链接：[OpenAPI接口调用约定](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/openapiinterfacecallconvention)
- 用途：定义 OpenAPI 的通用调用方式、请求约束、认证头和调用流程，是后续所有 OpenAPI 请求的基础规范。
- 当前代码关联：`backend/modules/douyin/clients/douyinOpenApi.client.js`

### 1.2 生成 client-token
- 链接：[生成 client-token](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/client_token)
- 用途：说明如何获取调用抖音 OpenAPI 所需的 `client-token/client access-token`。
- 当前代码关联：`backend/modules/douyin/services/token.service.js`

### 1.3 消息推送配置接入
- 链接：[消息推送配置接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/message-push-configuration-access)
- 用途：说明如何在抖音开放平台配置消息推送地址、订阅推送能力和接入注意事项。
- 当前代码关联：待系统化接入，可作为回调配置排查依据。

### 1.4 SPI 接入
- 链接：[SPI 接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/spi)
- 用途：说明 SPI 接口的整体接入模式、回调处理要求和平台调用约束。
- 当前代码关联：`backend/routes/douyin/douyinApi.js`、`backend/modules/douyin/controllers/hotelBooking.controller.js`

### 1.5 WebHooks接入
- 链接：[WebHooks接入](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/webhooks)
- 用途：说明 Webhook 推送模式的接入流程、配置方式和验签处理思路。
- 当前代码关联：当前未单独实现，可作为酒店静态信息处理结果推送等能力的参考。

### 1.6 SPI签名规则
- 链接：[SPI签名规则](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/spi-signature-rules)
- 用途：定义 SPI 请求签名串拼接方式、签名校验规则和安全要求。
- 当前代码关联：`backend/modules/douyin/crypto/signature.js`、`backend/modules/douyin/crypto/verifySign.js`、`backend/modules/douyin/middlewares/verifyDouyinSign.middleware.js`

### 1.7 平台返回状态码
- 链接：[平台返回状态码](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/returns-a-status-code)
- 用途：说明抖音开放平台通用返回状态码、错误码含义与处理建议。
- 当前代码关联：`backend/modules/douyin/controllers/*.js` 的错误响应映射可参考此文档完善。

### 1.8 加密字段解密方法
- 链接：[加密字段解密方法](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/decrypt)
- 用途：说明敏感字段的解密算法、参数要求和落地解密流程。
- 当前代码关联：`backend/modules/douyin/crypto/decrypt.js`、`backend/modules/douyin/crypto/decryptFields.js`

### 1.9 通用参数
- 链接：[通用参数](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/preparation/common-params)
- 用途：整理抖音开放平台接口的通用请求参数、公共字段和头部要求。
- 当前代码关联：`backend/modules/douyin/clients/douyinOpenApi.client.js`

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
- 当前代码关联：`backend/modules/douyin/services/confirmOrder.service.js`、`backend/modules/douyin/services/autoConfirm.service.js`

### 3.2 酒店创建订单
- 链接：[酒店创建订单](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-house-trade/hotel-booking)
- 用途：定义抖音向三方推送日历房订单创建时的回调字段、业务语义和订单主流程。
- 当前代码关联：`backend/modules/douyin/controllers/hotelBooking.controller.js`、`backend/modules/douyin/mappers/booking.mapper.js`、`backend/modules/douyin/services/hotelBooking.service.js`

## 4. 日历房交易逆向

### 4.1 酒店取消订单SPI
- 链接：[酒店取消订单SPI](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/hotel-order-cancel)
- 用途：定义抖音发起取消订单/逆向交易时，三方需要承接的 SPI 请求格式和处理要求。
- 当前代码关联：当前未实现，后续取消订单链路应优先参考此文档。

### 4.2 售后审核结果返回
- 链接：[售后审核结果返回](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/calendar-trading-reverse/order-cancellation-api)
- 用途：用于三方向抖音回传逆向售后审核结果、同意/拒绝取消等处理结果。
- 当前代码关联：当前未实现，需与“酒店取消订单SPI”配套接入。

## 5. 房型与静态信息

### 5.1 售卖房型静态信息接口
- 链接：[售卖房型静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/house-type-update/static-room-info-api)
- 用途：定义售卖房型的静态信息创建、更新或匹配所需字段。
- 当前代码关联：当前本地已有 `roomTypeMapping`，后续售卖房型正式接入需参考此文档补全。

### 5.2 物理房型静态信息查询
- 链接：[物理房型静态信息查询](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/room-info-access/room-static-info-query)
- 用途：查询抖音侧物理房型静态信息，是物理房型同步和匹配的基础接口。
- 当前代码关联：`backend/modules/douyin/services/physicalRoom.service.js`、`backend/modules/douyin/repositories/physicalRoom.repository.js`

### 5.3 自助匹配物理房型信息查询接口
- 链接：[自助匹配物理房型信息查询接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/room-info-access/room-info-query-api)
- 用途：用于查询或拉取可自助匹配的物理房型信息，辅助本地房型与抖音房型建立映射。
- 当前代码关联：`backend/modules/douyin/repositories/roomTypeMapping.repository.js`

## 6. 订单履约状态

### 6.1 入住/离店状态同步能力
- 链接：[入住/离店状态同步能力](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/check-in-out-sync/order-check-in-audit)
- 用途：定义订单入住、离店、核销等履约状态向抖音同步的接口能力与字段要求。
- 当前代码关联：当前未实现，后续订单 `checked-in/checked-out` 状态同步需优先对照此文档。

## 7. 酒店静态信息匹配/创建/更新能力

### 7.1 酒店静态信息接口
- 链接：[酒店静态信息接口](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-api)
- 用途：用于酒店基础静态信息的提交、匹配、创建和更新。
- 当前代码关联：当前未实现，后续酒店主体接入时使用。

### 7.2 酒店静态信息处理状态查询
- 链接：[酒店静态信息处理状态查询](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-status)
- 用途：查询酒店静态信息处理进度、审核结果和失败原因。
- 当前代码关联：当前未实现，后续静态信息提交后需要接入轮询或后台查询。

### 7.3 酒店静态信息处理结果推送Webhook
- 链接：[酒店静态信息处理结果推送Webhook](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/OpenAPI/JiuLv/calendarroom/hotel-info-mgmt/hotel-info-push)
- 用途：接收酒店静态信息处理结果的异步推送，适合替代或补充状态轮询。
- 当前代码关联：当前未实现，后续如采用异步通知模式需配套接入。

## 8. 当前最值得优先深读的文档

### 8.1 已经直接影响现有代码的文档
- `生成 client-token`
- `SPI 接入`
- `SPI签名规则`
- `酒店创建订单`
- `确认接单接口`
- `物理房型静态信息查询`

### 8.2 下一阶段最可能马上用到的文档
- `酒店取消订单SPI`
- `售后审核结果返回`
- `入住/离店状态同步能力`
- `售卖房型静态信息接口`
- `酒店通用错误码`
- `酒店日历房常见枚举列表`
