ALTER TABLE douyin_presale_orders
  DROP COLUMN IF EXISTS confirm_status,
  DROP COLUMN IF EXISTS confirm_number,
  DROP COLUMN IF EXISTS confirm_log_id,
  DROP COLUMN IF EXISTS confirm_error,
  DROP COLUMN IF EXISTS confirmed_at;

DROP INDEX IF EXISTS idx_douyin_presale_orders_confirm_status;
