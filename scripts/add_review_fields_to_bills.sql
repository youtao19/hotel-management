-- 为bills表添加好评相关字段的迁移脚本
-- 执行时间: 2025-06-29

-- 添加好评邀请相关字段
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS review_invited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS positive_review BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS review_invite_time TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS review_update_time TIMESTAMP DEFAULT NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN bills.review_invited IS '是否已邀请客户进行好评';
COMMENT ON COLUMN bills.positive_review IS '客户是否给出好评，NULL表示未设置，TRUE表示好评，FALSE表示差评';
COMMENT ON COLUMN bills.review_invite_time IS '发送好评邀请的时间';
COMMENT ON COLUMN bills.review_update_time IS '更新好评状态的时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_bills_review_invited ON bills(review_invited);
CREATE INDEX IF NOT EXISTS idx_bills_positive_review ON bills(positive_review);
CREATE INDEX IF NOT EXISTS idx_bills_review_invite_time ON bills(review_invite_time);
