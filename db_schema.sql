-- 房型表 (room_types)
CREATE TABLE room_types (
    type_code VARCHAR(20) PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_closed BOOLEAN NOT NULL
);

-- 房间表 (rooms)
CREATE TABLE rooms (
    room_id INT PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 订单表 (orders)
CREATE TABLE orders (
    order_id VARCHAR(20) PRIMARY KEY,
    id_source VARCHAR(50) NOT NULL,
    order_source VARCHAR(20) NOT NULL,
    guest_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(30) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL,
    payment_method VARCHAR(10),
    room_price DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    create_time TIMESTAMP NOT NULL,
    actual_check_in_time TIMESTAMP,
    actual_check_out_time TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

-- 库存表 (inventory)
CREATE TABLE inventory (
    date DATE NOT NULL,
    type_code VARCHAR(20) NOT NULL,
    total_rooms INT NOT NULL,
    available_rooms INT NOT NULL,
    price_adjustment DECIMAL(10,2),
    PRIMARY KEY (date, type_code),
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 添加索引以提高查询性能
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_check_dates ON orders(check_in_date, check_out_date);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_type ON rooms(type_code);
CREATE INDEX idx_inventory_date ON inventory(date);