-- 酒店管理系统数据库表结构初始化
-- 此脚本会在 PostgreSQL 容器首次启动时自动执行

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Table: account
CREATE TABLE IF NOT EXISTS account (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    email_verified BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    pw TEXT
);

CREATE INDEX IF NOT EXISTS accountemailindex ON account (email);

-- Table: room_types
CREATE TABLE IF NOT EXISTS room_types (
    type_code VARCHAR(20) PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    description TEXT,
    is_closed BOOLEAN DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_types_name ON room_types (type_name);

-- Table: rooms
CREATE TABLE IF NOT EXISTS rooms (
    room_id INTEGER PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms (type_code);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms (room_number);

-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(50) PRIMARY KEY,
    id_source VARCHAR(50),
    order_source VARCHAR(20) NOT NULL,
    guest_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20),
    total_price NUMERIC(10,2),
    deposit NUMERIC(10,2),
    create_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    stay_type TEXT,
    remarks TEXT,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number),
    UNIQUE (guest_name, check_in_date, check_out_date, room_type)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON orders (check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_orders_create_time ON orders (create_time DESC);

-- Table: bills
CREATE TABLE IF NOT EXISTS bills (
    bill_id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    guest_name VARCHAR(50),
    change_price NUMERIC(10,2) DEFAULT 0,
    change_type TEXT,
    pay_way VARCHAR(50) NOT NULL,
    create_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    remarks TEXT,
    stay_type TEXT,
    stay_date DATE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_bills_order_id ON bills (order_id);

-- Table: review_invitations
CREATE TABLE IF NOT EXISTS review_invitations (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL,
    invited BOOLEAN DEFAULT false NOT NULL,
    positive_review BOOLEAN,
    invite_time TIMESTAMP WITHOUT TIME ZONE,
    update_time TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_review_invitations_order_id ON review_invitations (order_id);
CREATE INDEX IF NOT EXISTS idx_review_invitations_invited ON review_invitations (invited);
CREATE INDEX IF NOT EXISTS idx_review_invitations_positive_review ON review_invitations (positive_review);

-- Table: order_changes
CREATE TABLE IF NOT EXISTS order_changes (
    change_id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    changed_by VARCHAR(50),
    changes JSONB,
    reason TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_changes_order_id ON order_changes (order_id);
CREATE INDEX IF NOT EXISTS idx_order_changes_changed_at ON order_changes (changed_at);

-- Table: handover
CREATE TABLE IF NOT EXISTS handover (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    handover_person VARCHAR(50) NOT NULL,
    takeover_person VARCHAR(50) NOT NULL,
    vip_card INTEGER DEFAULT 0,
    payment_type SMALLINT NOT NULL,
    reserve_cash NUMERIC(10,2) DEFAULT 0,
    room_income NUMERIC(10,2) DEFAULT 0,
    rest_income NUMERIC(10,2) DEFAULT 0,
    rent_income NUMERIC(10,2) DEFAULT 0,
    total_income NUMERIC(10,2) DEFAULT 0,
    room_refund NUMERIC(10,2) DEFAULT 0,
    rest_refund NUMERIC(10,2) DEFAULT 0,
    retained NUMERIC(10,2) DEFAULT 0,
    handover NUMERIC(10,2) DEFAULT 0,
    task_list JSONB DEFAULT '[]'::jsonb,
    remarks TEXT,
    UNIQUE (date, payment_type)
);

CREATE INDEX IF NOT EXISTS idx_handover_date ON handover (date);
CREATE UNIQUE INDEX IF NOT EXISTS unique_date_payment ON handover (date, payment_type);