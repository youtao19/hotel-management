# 抖音支持设置

## 自动接单

- 查询：`GET /api/douyin/settings`
- 更新：`PATCH /api/douyin/settings`
- 请求体：`{ "autoConfirmEnabled": true|false }`
- 所有接口均需员工 JWT。

设置保存于 `douyin_support_settings` 单例记录。首次尚未保存时，系统沿用 `DOUYIN_AUTO_CONFIRM_ENABLED` 的部署默认值；保存后立即对新进入的 `biz_type=2012` 预约订单生效，不需要重启服务。

- 开启：预约创单响应后，系统自动调用抖音确认接单接口。
- 关闭：预约单保留在待确认状态，员工在“抖音管理 → 预售订单 → 待确认预约订单”中手动接单或拒单。
