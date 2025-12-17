-- 迁移脚本：修复时间字段缺少时区的问题
-- 将 TIMESTAMP 改为 TIMESTAMPTZ，确保时区信息正确存储
-- 执行时间：2025-12-17

-- ============================================
-- 1. orders 表 - create_time
-- ============================================
ALTER TABLE orders 
  ALTER COLUMN create_time TYPE TIMESTAMPTZ 
  USING create_time AT TIME ZONE 'Asia/Shanghai';

ALTER TABLE orders 
  ALTER COLUMN create_time SET DEFAULT now();

-- ============================================
-- 2. bills 表 - create_time
-- ============================================
ALTER TABLE bills 
  ALTER COLUMN create_time TYPE TIMESTAMPTZ 
  USING create_time AT TIME ZONE 'Asia/Shanghai';

ALTER TABLE bills 
  ALTER COLUMN create_time SET DEFAULT now();

-- ============================================
-- 3. review_invitations 表 - invite_time, update_time
-- ============================================
ALTER TABLE review_invitations 
  ALTER COLUMN invite_time TYPE TIMESTAMPTZ 
  USING invite_time AT TIME ZONE 'Asia/Shanghai';

ALTER TABLE review_invitations 
  ALTER COLUMN update_time TYPE TIMESTAMPTZ 
  USING update_time AT TIME ZONE 'Asia/Shanghai';

-- ============================================
-- 验证修改结果
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('orders', 'bills', 'review_invitations')
--   AND column_name IN ('create_time', 'invite_time', 'update_time');
