-- idempotent migration: add missing columns and indexes referenced by code
-- Save as backend/database/postgreDB/migrations/add_missing_columns.sql
-- Usage:
-- psql -h <host> -p <port> -U <user> -d <db> -f add_missing_columns.sql

BEGIN;

-- bills table: pricing / refund fields
ALTER TABLE bills ADD COLUMN IF NOT EXISTS change_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS change_type TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refund_deposit DECIMAL(10,2);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refund_time TIMESTAMP;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50);

-- orders table: "show" used by unique partial index in repo
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "show" BOOLEAN DEFAULT TRUE;

-- Create commonly used indexes if missing
CREATE INDEX IF NOT EXISTS idx_bills_order_id ON bills(order_id);
CREATE INDEX IF NOT EXISTS idx_bills_create_time ON bills(create_time);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON orders(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_orders_create_time ON orders(create_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_room_price_gin ON orders USING GIN (room_price);
-- unique index used by repo (partial on active/show)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_active ON orders (guest_name, check_in_date, check_out_date, room_type) WHERE COALESCE("show", TRUE) = TRUE;

COMMIT;
