# 抖音 OpenAPI SDK 接入文档

> 更新时间：2026-04-01  
> 官方文档（用户提供）：[生活服务商家应用 OpenAPI SDK 总览](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/sdk-overview)

## 1. 文档目的
- 保存并沉淀抖音 OpenAPI SDK 官方接入资料，作为后续开发和排查依据。
- 给出本项目（Node.js 后端）优先可用的接入方式，减少重复踩坑。

## 2. SDK 总览（官方口径）
- 抖音开放平台提供统一服务端 OpenAPI SDK，用于简化接口调用流程。
- 当前支持语言：`Java`、`NodeJS`、`Go`。
- 重要说明：`Token` 需要业务侧自行注入，不能依赖 SDK 自动“全局正确处理”。

## 3. NodeJS 接入（本项目推荐）

### 3.1 安装依赖
```bash
npm add @open-dy/open_api_sdk
npm add @open-dy/open_api_credential
```

### 3.2 基础调用示例
```js
import Client, { MessageGetUserMessageRequest } from '@open-dy/open_api_sdk'
import CredentialClient from '@open-dy/open_api_credential'

async function callDouyinApi() {
  // 关键：先用 clientKey/clientSecret 获取 client_token
  const credentialClient = new CredentialClient({
    clientKey: process.env.DOUYIN_CLIENT_KEY,
    clientSecret: process.env.DOUYIN_CLIENT_SECRET,
  })
  const { accessToken } = await credentialClient.getClientToken()

  // 关键：初始化 SDK Client（仅负责请求能力，不替代业务侧 token 管理）
  const client = new Client({
    clientKey: process.env.DOUYIN_CLIENT_KEY,
    clientSecret: process.env.DOUYIN_CLIENT_SECRET,
  })

  // 关键：每次请求都要显式注入 accessToken
  const req = new MessageGetUserMessageRequest({
    accessToken,
    startTime: 1700000000,
    endTime: 1700003600,
    type: 1,
    username: 'demo',
    pageNum: 1,
    pageSize: 10,
  })

  const res = await client.messageGetUserMessage(req)
  return res
}
```

## 4. Java / Go 接入要点（简版）

### 4.1 Java
- Maven 仓库：`https://artifacts-cn-beijing.volces.com/repository/douyin-openapi/`
- SDK 包：`com.douyin.openapi:sdk`
- 初始化方式：`Config(clientKey, clientSecret) -> new Client(config)`
- 调用方式：构造 `XXXRequest`，注入 `accessToken`，再调用 `client.XXX(...)`

### 4.2 Go
- 安装包：`github.com/bytedance/douyin-openapi-sdk-go`
- 鉴权包：`github.com/bytedance/douyin-openapi-credential-go/client`
- 初始化方式：`openApiSdkClient.NewClient(config)`
- 调用方式：构造 `XXXRequest`，拿到 token 后填充 `AccessToken` 再发起调用

## 5. 当前项目落地建议

### 5.1 现状
- 当前项目已封装统一请求客户端：[backend/modules/douyin/clients/douyinOpenApi.client.js](/Users/peach/develop/hotel-management/backend/modules/douyin/clients/douyinOpenApi.client.js)。
- 当前方式基于 `axios + token.service`，已满足现有接口调用需求。

### 5.2 建议
- 短期：保持现有 `axios` 方案，优先保证业务接口稳定。
- 中期：若要切换 SDK，建议只在 `douyinOpenApi.client.js` 内部替换，不改上层业务 service 调用签名。
- 多实例部署时，token 管理统一放到后端服务层（可加 Redis/DB 缓存锁），避免 token 互刷。

## 6. 排查清单（实用）
- 请求失败先看三层：`HTTP 状态码`、`base_resp/error_code`、`业务字段是否合法`。
- 若出现间歇性鉴权失败，先排查是否存在多实例重复刷新 token。
- 新接入接口时，先在官方文档确认：请求方法、路径、必填字段、scope、枚举值。

## 7. 相关文档
- 抖音 OpenAPI SDK 总览（本页来源）：  
  [https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/sdk-overview](https://developer.open-douyin.com/docs/resource/zh-CN/local-life/develop/sdk-overview)
- 项目内抖音文档索引：  
  [docs/抖音官方api接口地址.md](/Users/peach/develop/hotel-management/docs/抖音官方api接口地址.md)
