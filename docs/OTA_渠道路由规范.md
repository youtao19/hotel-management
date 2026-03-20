# OTA 渠道路由规范

## 1. 统一前缀
- 所有 OTA 渠道接口统一使用 `/ota` 作为根前缀。

## 2. 已冻结路由
### 2.1 飞猪
- `POST /ota/fliggy/order/create`
- `POST /ota/fliggy/order/cancel`
- `POST /ota/fliggy/room/sync`

## 3. 当前实现状态
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
