-- 迁移日期: 2025-10-13
-- 描述: 删除身份证号字段并将手机号改为可选
-- 原因: 
--   1. 简化订单创建流程，不再强制要求身份证号
--   2. 手机号改为可选，允许无联系方式的订单（如前台现场办理）
--
-- 变更内容:
-- 1. 删除 id_number 列
-- 2. 将 phone 列改为可空

BEGIN;

-- 1. 删除 id_number 列
ALTER TABLE orders DROP COLUMN IF EXISTS id_number;

-- 2. 将 phone 列改为可空
ALTER TABLE orders ALTER COLUMN phone DROP NOT NULL;

COMMIT;

-- 验证修改
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'orders' AND column_name IN ('phone', 'id_number');

