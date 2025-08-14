-- 迁移：将 bills.refund_time 改为可空，并把未发生退款的记录的 refund_time 置 NULL
BEGIN;

-- 1. 修改列为可空（如果之前是 NOT NULL）
ALTER TABLE bills ALTER COLUMN refund_time DROP NOT NULL;

-- 2. 对未发生退款 (refund_deposit = 0) 的历史账单，将 refund_time 置为 NULL
UPDATE bills SET refund_time = NULL WHERE (refund_deposit = 0 OR refund_deposit IS NULL);

COMMIT;
