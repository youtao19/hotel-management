# Handover 接口文档

## 1. 文档范围
- 本文档覆盖交接班页面当前使用的核心接口，重点说明备用金确认相关口径。
- 前端入口：`/handover`
- 后端路由前缀：`/api/handover`

## 2. 备用金口径（确认页）
- 现金：固定 `320`
- 微信：取“昨日交接记录中的微信交接款（handover）”
- 微邮付：固定 `0`
- 其他：固定 `0`

说明：
- 例如在 `2026-02-12 08:30` 开始交接，当前要交接营业日是 `2026-02-11`，则备用金确认页微信值来自 `2026-02-10` 的微信交接款。

## 3. 接口清单

### 3.1 检查昨日交接记录
- Method：`GET`
- Path：`/api/handover/check-yesterday`
- Query：
```json
{
  "date": "YYYY-MM-DD"
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "date": "2026-02-10",
    "hasRecord": true,
    "isComplete": true,
    "paymentCount": 4,
    "paymentTypes": [1, 2, 3, 4],
    "handoverPerson": "A",
    "takeoverPerson": "B",
    "handoverAmounts": {
      "cash": 400,
      "wechat": 2197.5,
      "weiyoufu": 1144,
      "other": 0
    },
    "reserveDefaults": {
      "cash": 320,
      "wechat": 2197.5,
      "weiyoufu": 0,
      "other": 0
    }
  },
  "message": "已完成交接"
}
```

字段说明：
- `handoverAmounts`：指定日期的各支付方式交接款原始值。
- `reserveDefaults`：备用金确认页直接使用的默认值（后端统一口径）。

### 3.2 完成交接班
- Method：`POST`
- Path：`/api/handover/complete`
- 用途：保存交接班完整数据（四种支付方式）。

