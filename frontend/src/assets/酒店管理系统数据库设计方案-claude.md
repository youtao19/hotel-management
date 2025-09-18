# 酒店管理系统数据库设计方案

## 方案一：基础分离型设计

这种设计将各个功能模块清晰分开，便于理解和维护。

### 订单表 (orders)

| 字段名          | 数据类型 | 描述                              |
| --------------- | -------- | --------------------------------- |
| order_id        | int      | 订单ID (主键)                     |
| platform_source | varchar  | 订单来源平台 (美团/携程/飞猪等)   |
| source_id       | varchar  | 订单来源编号                      |
| customer_name   | varchar  | 客户姓名                          |
| phone           | varchar  | 联系电话                          |
| check_in_date   | date     | 入住日期                          |
| check_out_date  | date     | 退房日期                          |
| room_type_id    | int      | 房型ID (外键)                     |
| room_id         | int      | 分配的房间号 (外键)               |
| order_status    | varchar  | 订单状态 (已确认/已入住/已退房等) |
| payment_method  | varchar  | 支付方式 (平台支付/现金/微信等)   |
| total_amount    | decimal  | 订单总金额                        |
| create_time     | datetime | 订单创建时间                      |
| remark          | text     | 备注信息                          |

### 房型表 (room_types)

| 字段名       | 数据类型 | 描述          |
| ------------ | -------- | ------------- |
| room_type_id | int      | 房型ID (主键) |
| type_name    | varchar  | 房型名称      |
| price        | decimal  | 标准价格      |
| description  | text     | 房型描述      |
| total_count  | int      | 该房型总数量  |

### 房间表 (rooms)

| 字段名       | 数据类型 | 描述                                 |
| ------------ | -------- | ------------------------------------ |
| room_id      | int      | 房间ID (主键)                        |
| room_number  | varchar  | 房间号码                             |
| room_type_id | int      | 房型ID (外键)                        |
| floor        | int      | 楼层                                 |
| status       | varchar  | 房间状态 (空闲/已预订/已入住/维修中) |
| features     | varchar  | 房间特点 (如明窗/靠近电梯等)         |

### 平台库存表 (platform_inventory)

| 字段名          | 数据类型 | 描述          |
| --------------- | -------- | ------------- |
| inventory_id    | int      | 库存ID (主键) |
| platform_name   | varchar  | 平台名称      |
| room_type_id    | int      | 房型ID (外键) |
| available_count | int      | 可用数量      |
| update_time     | datetime | 最后更新时间  |

### 

### 现金流记录表 (cash_flow)

| 字段名           | 数据类型 | 描述                       |
| ---------------- | -------- | -------------------------- |
| flow_id          | int      | 流水ID (主键)              |
| flow_date        | date     | 记录日期                   |
| flow_type        | varchar  | 类型 (收入/支出/押金/退款) |
| payment_method   | varchar  | 支付方式 (现金/微信等)     |
| amount           | decimal  | 金额                       |
| related_order_id | int      | 关联订单ID (外键)          |
| operator         | varchar  | 操作人                     |
| remark           | text     | 备注                       |

