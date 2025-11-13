# API 文档

## 1. 检查交接记录

### 接口信息
- **路径**: `GET /api/handover/check-yesterday`
- **说明**: 检查指定日期的交接班记录是否完整

### 请求参数样例

```http
GET /api/handover/check-yesterday?date=2025-10-07
```

### 返回结果样例

#### 成功 - 已完成交接
```json
{
  "success": true,
  "data": {
    "date": "2025-10-07",
    "hasRecord": true,
    "isComplete": true,
    "paymentCount": 4,
    "paymentTypes": [1, 2, 3, 4],
    "handoverPerson": "张三",
    "takeoverPerson": "李四",
    "handoverAmounts": {
      "cash": 1500,
      "wechat": 2100,
      "weiyoufu": 900,
      "other": 350
    }
  },
  "message": "已完成交接"
}
```

#### 无交接记录
```json
{
  "success": true,
  "data": {
    "date": "2025-10-08",
    "hasRecord": false,
    "isComplete": false,
    "paymentCount": 0,
    "paymentTypes": [],
    "handoverPerson": null,
    "takeoverPerson": null,
    "handoverAmounts": {
      "cash": 0,
      "wechat": 0,
      "weiyoufu": 0,
      "other": 0
    }
  },
  "message": "无交接记录"
}
```

#### 交接记录不完整
```json
{
  "success": true,
  "data": {
    "date": "2025-10-06",
    "hasRecord": true,
    "isComplete": false,
    "paymentCount": 2,
    "paymentTypes": [1, 2],
    "handoverPerson": "王五",
    "takeoverPerson": "赵六",
    "handoverAmounts": {
      "cash": 0,
      "wechat": 0,
      "weiyoufu": 0,
      "other": 0
    }
  },
  "message": "交接记录不完整"
}
```

#### 错误响应
```json
{
  "success": false,
  "message": "缺少必需的日期参数"
}
```

---

## 2. 完成交接班

### 接口信息
- **路径**: `POST /api/handover/complete`
- **说明**: 保存完整的交接班数据

### 请求参数样例

```json
{
  "date": "2025-10-08",
  "handoverPerson": "张三",
  "receivePerson": "李四",
  "vipCard": 1000,
  "paymentData": {
    "reserve": {
      "现金": 500,
      "微信": 0,
      "微邮付": 0,
      "其他": 0
    },
    "hotelIncome": {
      "现金": 1500,
      "微信": 2000,
      "微邮付": 800,
      "其他": 300
    },
    "restIncome": {
      "现金": 300,
      "微信": 400,
      "微邮付": 150,
      "其他": 50
    },
    "carRentIncome": {
      "现金": 200,
      "微信": 0,
      "微邮付": 0,
      "其他": 0
    },
    "totalIncome": {
      "现金": 2000,
      "微信": 2400,
      "微邮付": 950,
      "其他": 350
    },
    "hotelDeposit": {
      "现金": 100,
      "微信": 200,
      "微邮付": 50,
      "其他": 0
    },
    "restDeposit": {
      "现金": 50,
      "微信": 100,
      "微邮付": 0,
      "其他": 0
    },
    "retainedAmount": {
      "现金": 850,
      "微信": 0,
      "微邮付": 0,
      "其他": 0
    },
    "handoverAmount": {
      "现金": 1500,
      "微信": 2100,
      "微邮付": 900,
      "其他": 350
    }
  },
  "taskList": [
    {
      "id": 1,
      "content": "检查房间清洁状况",
      "completed": false
    },
    {
      "id": 2,
      "content": "补充客房用品",
      "completed": true
    }
  ],
  "notes": "今日客流量较大，注意库存补充"
}
```

### 返回结果样例

#### 成功响应
```json
{
  "success": true,
  "message": "交接班完成，数据已保存",
  "data": {
    "date": "2025-10-08",
    "handoverPerson": "张三",
    "receivePerson": "李四",
    "recordCount": 4,
    "records": [
      {
        "id": 101,
        "date": "2025-10-08",
        "handover_person": "张三",
        "takeover_person": "李四",
        "vip_card": 1000,
        "payment_type": 1,
        "reserve_cash": 500,
        "room_income": 1500,
        "rest_income": 300,
        "rent_income": 200,
        "total_income": 2000,
        "room_refund": 100,
        "rest_refund": 50,
        "retained": 850,
        "handover": 1500,
        "task_list": "[{\"id\":1,\"content\":\"检查房间清洁状况\",\"completed\":false},{\"id\":2,\"content\":\"补充客房用品\",\"completed\":true}]",
        "remarks": "今日客流量较大，注意库存补充"
      },
      {
        "id": 102,
        "date": "2025-10-08",
        "handover_person": "张三",
        "takeover_person": "李四",
        "vip_card": 0,
        "payment_type": 2,
        "reserve_cash": 0,
        "room_income": 2000,
        "rest_income": 400,
        "rent_income": 0,
        "total_income": 2400,
        "room_refund": 200,
        "rest_refund": 100,
        "retained": 0,
        "handover": 2100,
        "task_list": "[]",
        "remarks": ""
      },
      {
        "id": 103,
        "date": "2025-10-08",
        "handover_person": "张三",
        "takeover_person": "李四",
        "vip_card": 0,
        "payment_type": 3,
        "reserve_cash": 0,
        "room_income": 800,
        "rest_income": 150,
        "rent_income": 0,
        "total_income": 950,
        "room_refund": 50,
        "rest_refund": 0,
        "retained": 0,
        "handover": 900,
        "task_list": "[]",
        "remarks": ""
      },
      {
        "id": 104,
        "date": "2025-10-08",
        "handover_person": "张三",
        "takeover_person": "李四",
        "vip_card": 0,
        "payment_type": 4,
        "reserve_cash": 0,
        "room_income": 300,
        "rest_income": 50,
        "rent_income": 0,
        "total_income": 350,
        "room_refund": 0,
        "rest_refund": 0,
        "retained": 0,
        "handover": 350,
        "task_list": "[]",
        "remarks": ""
      }
    ]
  }
}
```

#### 错误响应

缺少日期参数：
```json
{
  "success": false,
  "message": "缺少必需的日期参数"
}
```

缺少接班人姓名：
```json
{
  "success": false,
  "message": "请输入接班人员姓名"
}
```

缺少支付数据：
```json
{
  "success": false,
  "message": "缺少支付数据"
}
```

服务器错误：
```json
{
  "success": false,
  "message": "完成交接班失败",
  "error": "错误堆栈信息"
}
```

---

## 3. 获取指定日期账单

### 接口信息
- **路径**: `GET /api/bills/by-date/:date`
- **说明**: 获取指定日期的所有账单数据，用于交接班核对。返回原始账单记录，不做聚合。

### 业务规则
- **房费、收押、订单账单**：按 `stay_date` (入住日期) 过滤
- **退押、退款、补收**：按 `create_time` (创建时间) 过滤
- 账单按住宿类型（客房/休息房）分组返回

### 请求参数样例

```http
GET /api/bills/by-date/2025-10-07
```

### 返回结果样例

#### 成功响应
```json
{
  "success": true,
  "data": {
    "hotelBills": [
      {
        "bill_id": 123,
        "order_id": "O20251008082555",
        "stay_date": "2025-10-07",
        "stay_type": "客房",
        "change_type": "房费",
        "change_price": 388,
        "pay_way": "现金",
        "create_time": "2025-10-07T14:30:00.000Z",
        "room_number": "115",
        "guest_name": "陈敏",
        "phone": "13800138000",
        "order_status": "已入住"
      },
      {
        "bill_id": 124,
        "order_id": "O20251008082555",
        "stay_date": "2025-10-07",
        "stay_type": "客房",
        "change_type": "收押",
        "change_price": 152,
        "pay_way": "现金",
        "create_time": "2025-10-07T14:30:00.000Z",
        "room_number": "115",
        "guest_name": "陈敏",
        "phone": "13800138000",
        "order_status": "已入住"
      }
    ],
    "restBills": [
      {
        "bill_id": 125,
        "order_id": "O20251008080093",
        "stay_date": "2025-10-07",
        "stay_type": "休息房",
        "change_type": "房费",
        "change_price": 144,
        "pay_way": "微信",
        "create_time": "2025-10-07T10:15:00.000Z",
        "room_number": "106",
        "guest_name": "刘敏",
        "phone": "13900139000",
        "order_status": "已退房"
      },
      {
        "bill_id": 126,
        "order_id": "O20251008080093",
        "stay_date": "2025-10-07",
        "stay_type": "休息房",
        "change_type": "收押",
        "change_price": 50,
        "pay_way": "微信",
        "create_time": "2025-10-07T10:15:00.000Z",
        "room_number": "106",
        "guest_name": "刘敏",
        "phone": "13900139000",
        "order_status": "已退房"
      }
    ],
    "totalCount": 4
  },
  "message": "成功获取 2025-10-07 的账单数据"
}
```

#### 无数据响应
```json
{
  "success": true,
  "data": {
    "hotelBills": [],
    "restBills": [],
    "totalCount": 0
  },
  "message": "成功获取 2025-10-08 的账单数据"
}
```

#### 错误响应
```json
{
  "success": false,
  "message": "获取指定日期账单失败",
  "error": "Invalid date format"
}
```

### 字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| bill_id | number | 账单ID |
| order_id | string | 订单号 |
| stay_date | string | 入住日期 |
| stay_type | string | 住宿类型（客房/休息房） |
| change_type | string | 账单类型（房费/收押/退押/补收/退款/订单账单） |
| change_price | number | 金额（正数=收入，负数=支出） |
| pay_way | string | 支付方式 |
| create_time | string | 创建时间 |
| room_number | string | 房间号 |
| guest_name | string | 客人姓名 |
| phone | string | 电话号码 |
| order_status | string | 订单状态 |

### 注意事项

1. **日期格式**：必须使用 `YYYY-MM-DD` 格式
2. **账单类型**：
   - 收入类：房费、收押、补收、订单账单（正数）
   - 支出类：退押、退款（负数）
3. **数据完整性**：返回所有符合条件的原始账单，不做聚合
4. **住宿类型过滤**：自动按客房和休息房分组
