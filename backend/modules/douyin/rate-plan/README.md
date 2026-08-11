# 售卖套餐接口说明

## 新增套餐房型候选

`GET /api/rate-plans/room-type-options`

用于“新增套餐”的关联房型下拉框。接口只返回同时满足以下条件的本地房型：

- 已在 `douyin_room_type_mapping` 中关联抖音物理房型；
- 关联的物理房型缓存仍存在，且未停用；
- 当配置了 `DOUYIN_ACCOUNT_ID`、`DOUYIN_POI_ID` 时，物理房型属于当前账号和门店。

响应中的 `type_code`、`type_name`、`base_price` 分别为本地房型编码、名称和基础价。

## 创建套餐校验

`POST /api/rate-plans` 的 `room_type_code` 除了必须存在于 `room_types` 外，还必须属于上述当前抖音门店的有效关联房型。否则返回 `400`：

```json
{
  "message": "房型未关联当前抖音门店，无法创建售卖套餐"
}
```
