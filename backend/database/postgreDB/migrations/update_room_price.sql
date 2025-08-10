-- 迁移脚本：将 orders 表的 room_price 字段从 DECIMAL 改为 JSONB
-- 执行命令：psql -U postgres -d hotel_management -f update_room_price.sql

\echo '开始迁移：将 room_price 字段从 DECIMAL 改为 JSONB...'

-- 1. 检查当前字段类型
\echo '1. 检查当前 room_price 字段类型...'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name = 'room_price' 
  AND table_schema = 'public';

-- 2. 备份现有数据并检查数据量
\echo '2. 检查现有数据...'
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as orders_with_price FROM orders WHERE room_price IS NOT NULL;

-- 3. 创建临时列
\echo '3. 创建临时 JSONB 列...'
ALTER TABLE orders ADD COLUMN room_price_jsonb JSONB;

-- 4. 转换现有数据：将单个价格转换为 {check_in_date: price} 格式
\echo '4. 转换价格数据格式...'
UPDATE orders 
SET room_price_jsonb = jsonb_build_object(
    DATE(check_in_date)::text, 
    room_price::numeric
)
WHERE room_price IS NOT NULL;

-- 5. 检查转换结果
\echo '5. 验证转换结果...'
SELECT 
    order_id,
    room_price as old_price,
    room_price_jsonb as new_price
FROM orders 
WHERE room_price IS NOT NULL 
LIMIT 5;

-- 6. 删除原字段
\echo '6. 删除原 room_price 字段...'
ALTER TABLE orders DROP COLUMN room_price;

-- 7. 重命名新字段
\echo '7. 重命名字段...'
ALTER TABLE orders RENAME COLUMN room_price_jsonb TO room_price;

-- 8. 添加约束
\echo '8. 添加 JSONB 约束...'
ALTER TABLE orders 
ADD CONSTRAINT chk_room_price_json 
CHECK (jsonb_typeof(room_price) = 'object');

-- 9. 添加索引
\echo '9. 创建 GIN 索引...'
CREATE INDEX IF NOT EXISTS idx_orders_room_price_gin ON orders USING GIN (room_price);

-- 10. 设置为 NOT NULL（如果需要）
\echo '10. 设置字段约束...'
ALTER TABLE orders ALTER COLUMN room_price SET NOT NULL;

-- 11. 验证最终结果
\echo '11. 验证迁移结果...'
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name = 'room_price' 
  AND table_schema = 'public';

\echo '✅ 迁移完成！room_price 字段已成功转换为 JSONB 类型'
