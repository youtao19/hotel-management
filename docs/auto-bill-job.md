# 自动创建账单流程说明

本文档汇总 18:00 自动账单任务的工作流程，便于在交接或排查问题时快速了解关键代码路径。

## 1. 启动入口

1. `backend/appSettings/schedulers/autoBillJob.js` 使用 `node-cron` 注册 `AUTO_BILL_CRON`（默认 `0 18 * * *`）任务。
2. `backend/server.js` 在 `bootup()` 中 `startAutoBillJob()`，因此服务启动后会自动等待 18:00 触发。
3. 所有配置来自 `.env`（`AUTO_BILL_*`），由 `backend/appSettings/setup.js` 解析为 `setup.autoBillJob`。

## 2. 日常执行流程

当 cron 触发时，`runAutoBillJob()`（`backend/modules/autoBillService.js`）会依次执行以下步骤：

1. **确定目标日期**  
   - 默认使用当前时间按 `AUTO_BILL_TZ` 转换后的 `YYYY-MM-DD`；手动触发可传入 `targetDate`。

2. **读取订单候选集**  
   - SQL：`SELECT ... FROM orders WHERE check_in_date <= $1 AND check_out_date > $1 AND status = ANY($2)`  
   - `$1`=目标日期，`$2`=状态白名单（默认 `pending,reserved`），保证仅处理“仅有订单、未取消/未入住”的记录。

3. **逐单生成日账单**  
   对每个候选订单执行：
   - 计算日均房费：`total_price / (check_out_date - check_in_date)`，默认保留两位小数。
   - 幂等检查：`SELECT 1 FROM bills WHERE order_id=$1 AND stay_date=$2 AND change_type='房费'`；存在则记入 `skippedExisting`。
   - 若金额 ≤ 0，记入 `skippedNoAmount`；否则插入一条 `bills` 记录：
     ```
     order_id, room_number, guest_name,
     change_price=日金额, change_type='房费',
     pay_way=normalize(payment_method),
     stay_type=按入住/退房日期判断客房或休息房,
     stay_date=目标日期,
     remarks='自动创建当日账单（2025-05-02）'
     ```

4. **结果收集与监控**  
   - 累计 `createdBills / skipped / failures` 信息。
   - 任务结束后根据 `AUTO_BILL_ALERT_EMAILS` 调用 `emailSetup.sendSystemEmail`，只发送邮件（监控方式限定为 email）。

## 3. 手动触发与测试

- `backend/appSettings/schedulers/autoBillJob.js` 导出 `runAutoBillJobOnce(options)`，可以在脚本或工具中手动调用。
- `backend/tests/autoBillJob.test.js` 覆盖以下场景：
  1. 创建一个跨越目标日的 `pending` 订单。
  2. 触发 `runAutoBillJob({ targetDate, forceRun: true, disableReport: true })`，验证插入一条账单且金额正确。
  3. 再次执行任务，确认不会重复生成（命中 `skippedExisting`）。

## 4. 配置项速查

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `AUTO_BILL_ENABLED` | 是否启用任务 | `true` |
| `AUTO_BILL_CRON` | 定时表达式 | `0 18 * * *` |
| `AUTO_BILL_TZ` | 业务时区 | `Asia/Shanghai` |
| `AUTO_BILL_STATUS_WHITELIST` | 订单状态白名单（逗号分隔） | `pending,reserved` |
| `AUTO_BILL_ALERT_EMAILS` | 汇总邮件接收人（逗号分隔，留空则使用 `ADMIN_EMAIL`） | `` |

将本文件同步给运营或排查同学，即可快速了解 18:00 自动账单的核心流程。
