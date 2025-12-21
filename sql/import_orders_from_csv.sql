-- 用法（在项目根目录执行）：
--   docker compose exec -T postgres psql -U peach -d hotel_db -f sql/import_orders_from_csv.sql
--
-- 说明：
-- - 需要已存在表 `orders`（包含 NOT NULL 的 `stay_date`）
-- - 本脚本使用 psql 的 `\copy` 从“客户端路径”读取 `sql/orders.csv`（相对路径，需在项目根目录执行）
-- - 显式列清单，避免因列顺序/映射导致 `stay_date` 变成 NULL

\copy orders (order_id,id_source,order_source,guest_name,phone,room_type,room_number,check_in_date,check_out_date,stay_date,status,payment_method,total_price,deposit,create_time,stay_type,remarks,is_prepaid,prepaid_amount) FROM 'sql/orders.csv' WITH (FORMAT csv, HEADER true);



-- 执行 psql -h 127.0.0.1 -U peach -d hotel_db -f 'sql/import_orders_from_csv.sql'