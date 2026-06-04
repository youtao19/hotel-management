# Handover 接口文档

## 1. 文档范围
- 前端入口：`/handover`
- 后端路由前缀：`/api/handover`
- 当前交接班页面固定为“交接表格 + 交接确认”单页形态，不再使用旧的 1-6 步向导。

## 2. 业务口径
- 交接班表格金额由后端生成。
- 备用金默认值由后端生成：现金固定 `320`，微信取昨日微信交接款，微邮付和其他为 `0`。
- 留存款允许前端在表格内调整，但保存时后端会基于同一套表格数据重新计算交接款。
- `DATE` 字段按 `YYYY-MM-DD` 字符串传输，不做 UTC 转换。

## 3. 获取当前交接班页面数据
- Method：`GET`
- Path：`/api/handover/overview`
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
    "businessDate": "2026-06-04",
    "currentShift": {
      "code": "morning",
      "label": "早班",
      "timeRange": "08:00-16:00"
    },
    "currentUser": {
      "id": 1,
      "name": "youtao",
      "role": "管理员"
    },
    "yesterdayRecord": {
      "date": "2026-06-03",
      "hasRecord": true,
      "isComplete": true,
      "paymentCount": 4,
      "paymentTypes": [1, 2, 3, 4],
      "handoverPerson": "A",
      "takeoverPerson": "B",
      "handoverAmounts": {
        "现金": 400,
        "微信": 2197.5,
        "微邮付": 1144,
        "其他": 0
      },
      "reserveDefaults": {
        "现金": 320,
        "微信": 2197.5,
        "微邮付": 0,
        "其他": 0
      },
      "statusText": "已完成"
    },
    "paymentData": {
      "reserve": {},
      "hotelIncome": {},
      "restIncome": {},
      "carRentIncome": {},
      "totalIncome": {},
      "hotelRefundDeposit": {},
      "restRefundDeposit": {},
      "totalRefundDeposit": {},
      "retainedAmount": {},
      "handoverAmount": {}
    },
    "specialStats": {
      "openCount": 0,
      "restCount": 0,
      "invited": 0,
      "positive": 0
    },
    "canComplete": true,
    "completeBlockReasons": []
  }
}
```

## 4. 完成交接班
- Method：`POST`
- Path：`/api/handover/complete`
- 用途：保存指定日期的交接班数据。前端不提交整张金额表，后端按 `date` 重新生成表格金额。

请求体：
```json
{
  "date": "2026-06-04",
  "receivePerson": "peach",
  "retainedAmount": {
    "现金": 320,
    "微信": 0,
    "微邮付": 0,
    "其他": 0
  },
  "vipCard": 0,
  "notes": "交接备注"
}
```

成功响应示例：
```json
{
  "success": true,
  "message": "交接班完成，数据已保存",
  "data": {
    "date": "2026-06-04",
    "handoverPerson": "youtao",
    "receivePerson": "peach",
    "recordCount": 4,
    "records": []
  }
}
```

## 5. 历史记录

### 5.1 查询历史记录列表
- Method：`GET`
- Path：`/api/handover/query`

### 5.2 查询历史记录表格详情
- Method：`GET`
- Path：`/api/handover/handover-table`
- Query：
```json
{
  "date": "YYYY-MM-DD"
}
```

### 5.3 查询历史记录特殊统计
- Method：`GET`
- Path：`/api/handover/special-stats`
- Query：
```json
{
  "date": "YYYY-MM-DD"
}
```

### 5.4 查询历史记录备忘录
- Method：`GET`
- Path：`/api/handover/admin-memos`
- Query：
```json
{
  "date": "YYYY-MM-DD"
}
```
