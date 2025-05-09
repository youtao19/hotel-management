-- 插入房型数据
INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
VALUES
    ('standard', '标准间', 288.00, '舒适标准双人间，配备基础设施', false),
    ('deluxe', '豪华间', 388.00, '豪华装修双人间，配备高档设施', false),
    ('suite', '套房', 588.00, '独立客厅与卧室，尊享舒适空间', false),
    ('presidential', '总统套房', 1288.00, '顶级豪华套房，配备全套高端设施与服务', false),
    ('family', '家庭房', 688.00, '适合家庭入住的宽敞房间，配备儿童设施', false);

-- 插入房间数据 (从roomStore.js)
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
    (504, '504', 'family', 'reserved', 688.00);

-- 插入订单数据 (从orderStore.js)
INSERT INTO orders (
    order_id, id_source, order_source, guest_name, phone, id_number, 
    room_type, room_number, check_in_date, check_out_date, 
    status, payment_method, room_price, deposit, create_time, remarks
)
VALUES
    (
        'O20230610001', '前台', '线下', '张三', '13812345678', '110101199001011234',
        'standard', '101', '2023-06-10', '2023-06-12',
        '已退房', 'cash', 576.00, 200.00, '2023-06-10 14:30:00', ''
    ),
    (
        'O20230615002', '前台', '线下', '李四', '13987654321', '310101199203034321',
        'deluxe', '201', '2023-06-15', '2023-06-18',
        '已入住', 'wechat', 1164.00, 300.00, '2023-06-15 10:15:00', '客人需要加床'
    ),
    (
        'O20230615003', '前台', '线下', '吴友桃', '19951339211', '310101199203034321',
        'deluxe', '201', '2023-06-15', '2023-06-18',
        '待入住', 'wechat', 1164.00, 300.00, '2023-06-15 10:15:00', '客人需要加床'
    );

-- 插入库存数据 (根据房型和可用房间数据生成)
INSERT INTO inventory (date, type_code, total_rooms, available_rooms, price_adjustment)
VALUES
    (CURRENT_DATE, 'standard', 10, 6, 0.00),
    (CURRENT_DATE, 'deluxe', 11, 7, 0.00),
    (CURRENT_DATE, 'suite', 6, 4, 0.00),
    (CURRENT_DATE, 'presidential', 3, 2, 0.00),
    (CURRENT_DATE, 'family', 4, 2, 0.00),
    (CURRENT_DATE + 1, 'standard', 10, 6, 0.00),
    (CURRENT_DATE + 1, 'deluxe', 11, 7, 0.00),
    (CURRENT_DATE + 1, 'suite', 6, 4, 0.00),
    (CURRENT_DATE + 1, 'presidential', 3, 2, 0.00),
    (CURRENT_DATE + 1, 'family', 4, 2, 0.00),
    (CURRENT_DATE + 2, 'standard', 10, 6, 0.00),
    (CURRENT_DATE + 2, 'deluxe', 11, 7, 0.00),
    (CURRENT_DATE + 2, 'suite', 6, 4, 0.00),
    (CURRENT_DATE + 2, 'presidential', 3, 2, 0.00),
    (CURRENT_DATE + 2, 'family', 4, 2, 0.00);

-- 创建用户表 (由于schema中未包含，但userStore.js中有用户数据)
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(100) NOT NULL,
    avatar VARCHAR(255),
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入用户数据
INSERT INTO users (username, password, avatar, role)
VALUES
    ('admin', '$2a$10$Xn3b0VB920Sw7UDWPQ8rbuIr2tZhpXI8xc6QMiH1I1JQZZh1JyM02', 'https://cdn.quasar.dev/img/boy-avatar.png', '管理员'),
    ('staff', '$2a$10$Xn3b0VB920Sw7UDWPQ8rbuIr2tZhpXI8xc6QMiH1I1JQZZh1JyM02', 'https://cdn.quasar.dev/img/boy-avatar.png', '员工'); 