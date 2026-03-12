# OTA 渠道路由规范

## 1. 统一前缀
- 所有 OTA 渠道接口统一使用 `/ota` 作为根前缀。

## 2. 已冻结路由
### 2.1 抖音
- `POST /ota/douyin/order/create`
- `POST /ota/douyin/order/cancel`
- `POST /ota/douyin/room/sync`
- `POST /ota/douyin/room/static/sync`
- `POST /ota/douyin/webhook`

### 2.2 飞猪
- `POST /ota/fliggy/order/create`
- `POST /ota/fliggy/order/cancel`
- `POST /ota/fliggy/room/sync`

## 3. 当前实现状态
- 抖音：
  - 已实现 `order/create`
  - 已实现 `order/cancel`
  - 已实现 `room/sync`
  - 已实现 `room/static/sync`
  - 已实现 `webhook`
- 飞猪：
  - 路由已注册
  - 当前统一返回 `501`
  - 错误码：`FLIGGY_NOT_IMPLEMENTED`

## 4. 统一错误结构

```json
{
  "success": false,
  "message": "错误说明",
  "error": {
    "code": "CHANNEL_ERROR_CODE",
    "details": null
  }
}
```
