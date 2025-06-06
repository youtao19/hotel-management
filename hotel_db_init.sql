-- 创建数据库（如果不存在）
-- CREATE DATABASE hotel_management; -- 这由pg.js在连接前处理

-- 房型表 (room_types)
CREATE TABLE IF NOT EXISTS room_types (
    type_code VARCHAR(20) PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT false
);

-- 房间表 (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 订单表 (orders)
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(20) PRIMARY KEY,
    id_source VARCHAR(50),
    order_source VARCHAR(20) NOT NULL,
    guest_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(30) NOT NULL,
    room_type VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20),
    room_price DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    create_time TIMESTAMP NOT NULL,
    remarks TEXT,
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

-- 插入房型数据
INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
VALUES
    ('standard', '标准间', 288.00, '舒适标准双人间，配备基础设施', false),
    ('deluxe', '豪华间', 388.00, '豪华装修双人间，配备高档设施', false),
    ('suite', '套房', 588.00, '独立客厅与卧室，尊享舒适空间', false),
    ('presidential', '总统套房', 1288.00, '顶级豪华套房，配备全套高端设施与服务', false),
    ('family', '家庭房', 688.00, '适合家庭入住的宽敞房间，配备儿童设施', false)
ON CONFLICT DO NOTHING;

-- 插入房间数据
INSERT INTO rooms (room_id, room_number, type_code, status, price)
VALUES
    -- 标准间
    (1, '101', 'standard', 'available', 288.00),
    (2, '102', 'standard', 'occupied', 288.00),
    (3, '103', 'standard', 'cleaning', 288.00),
    (4, '104', 'standard', 'reserved', 288.00),
    (5, '105', 'standard', 'maintenance', 288.00),
    (106, '106', 'standard', 'available', 288.00),
    (107, '107', 'standard', 'available', 288.00),
    (108, '108', 'standard', 'available', 288.00),
    (109, '109', 'standard', 'available', 288.00),
    (110, '110', 'standard', 'available', 288.00),
    
    -- 豪华间
    (6, '201', 'deluxe', 'available', 388.00),
    (7, '202', 'deluxe', 'occupied', 388.00),
    (8, '203', 'deluxe', 'available', 388.00),
    (9, '204', 'deluxe', 'reserved', 388.00),
    (205, '205', 'deluxe', 'available', 388.00),
    (206, '206', 'deluxe', 'available', 388.00),
    (207, '207', 'deluxe', 'available', 388.00),
    (208, '208', 'deluxe', 'available', 388.00),
    
    -- A座高级豪华间
    (210, 'A201', 'deluxe', 'available', 428.00),
    (211, 'A202', 'deluxe', 'available', 428.00),
    (212, 'A203', 'deluxe', 'available', 428.00),
    
    -- 套房
    (10, '301', 'suite', 'available', 588.00),
    (11, '302', 'suite', 'occupied', 588.00),
    (12, '303', 'suite', 'cleaning', 588.00),
    (304, '304', 'suite', 'available', 588.00),
    (305, '305', 'suite', 'available', 588.00),
    (306, '306', 'suite', 'available', 588.00),
    
    -- 总统套房
    (401, '401', 'presidential', 'available', 1288.00),
    (402, '402', 'presidential', 'available', 1288.00),
    (403, '403', 'presidential', 'occupied', 1588.00),
    
    -- 家庭房
    (501, '501', 'family', 'available', 688.00),
    (502, '502', 'family', 'occupied', 688.00),
    (503, '503', 'family', 'available', 688.00),
    (504, '504', 'family', 'reserved', 688.00)
ON CONFLICT DO NOTHING;

-- 插入订单数据
INSERT INTO orders (
    order_id, id_source, order_source, guest_name, phone, id_number,
    room_type, room_number, check_in_date, check_out_date, status,
    payment_method, room_price, deposit, create_time,
    actual_check_in_time, actual_check_out_time, remarks
) VALUES
    (
        'ORD20240001', NULL, 'online', '张三', '13800138000', '110101199001011234',
        'standard', '102', '2024-04-01', '2024-04-03', 'checked_out',
        'wechat', 576.00, 200.00, '2024-03-30 15:30:00',
        '2024-04-01 14:00:00', '2024-04-03 12:00:00', '需要安静的房间'
    ),
    (
        'ORD20240002', NULL, 'phone', '李四', '13900139000', '310101199102023456',
        'deluxe', '202', '2024-04-05', '2024-04-08', 'checked_out',
        'alipay', 1164.00, 300.00, '2024-04-03 09:15:00',
        '2024-04-05 13:45:00', '2024-04-08 11:30:00', '商务客人，需要提供发票'
    ),
    (
        'ORD20240003', NULL, 'walk_in', '王五', '13700137000', '440101199203034567',
        'standard', '103', '2024-04-07', '2024-04-10', 'confirmed',
        'cash', 864.00, 200.00, '2024-04-06 16:40:00',
        NULL, NULL, '临时决定入住，需要加床'
    ),
    (
        'ORD20240004', NULL, 'online', '赵六', '13600136000', '510101199304045678',
        'suite', '302', '2024-04-12', '2024-04-15', 'reserved',
        'wechat', 1764.00, 500.00, '2024-04-05 10:25:00',
        NULL, NULL, '生日庆祝，需要准备蛋糕'
    ),
    (
        'ORD20240005', NULL, 'agency', '钱七', '13500135000', '330101199405056789',
        'family', '502', '2024-04-20', '2024-04-25', 'confirmed',
        'bank_transfer', 3440.00, 688.00, '2024-04-10 11:10:00',
        NULL, NULL, '家庭出游，需要儿童设施'
    )
ON CONFLICT DO NOTHING;

-- 修改房间表的room_number字段长度
ALTER TABLE rooms ALTER COLUMN room_number TYPE VARCHAR(20);

-- 修改订单表的room_number字段长度
ALTER TABLE orders ALTER COLUMN room_number TYPE VARCHAR(20); 