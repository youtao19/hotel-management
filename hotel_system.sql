-- 房型表 (room_types)
CREATE TABLE room_types (
    type_code VARCHAR(20) PRIMARY KEY,                  -- 房型代码(standard/deluxe/suite/presidential/family)
    type_name VARCHAR(50) NOT NULL,                     -- 房型名称(标准间/豪华间/套房/总统套房/家庭房)
    base_price DECIMAL(10,2) NOT NULL,                  -- 基础价格
    max_guests INT NOT NULL,                            -- 最大容纳人数
    area INT,                                           -- 房间面积(平方米)
    has_window BOOLEAN NOT NULL DEFAULT TRUE,           -- 是否有窗
    bed_type VARCHAR(20) NOT NULL,                      -- 床型(大床/双床/多床)
    description TEXT,                                   -- 房型描述
    amenities TEXT,                                     -- 设施和服务
    image_url VARCHAR(255)                              -- 图片URL
);

-- 房间表 (rooms)
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,                              -- 房间ID
    room_number VARCHAR(10) NOT NULL UNIQUE,            -- 房间号码
    type_code VARCHAR(20) NOT NULL,                     -- 房间类型代码
    floor INT NOT NULL,                                 -- 楼层
    building VARCHAR(10),                               -- 楼栋(如A座)
    status VARCHAR(20) NOT NULL,                        -- 房间状态(available/occupied/reserved/cleaning/maintenance)
    price DECIMAL(10,2) NOT NULL,                       -- 当前定价
    current_guest VARCHAR(50),                          -- 当前入住客人姓名
    check_out_date DATE,                                -- 预计退房日期
    last_cleaned TIMESTAMP,                             -- 最后清扫时间
    maintenance_notes TEXT,                             -- 维修记录
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 订单表 (orders)
CREATE TABLE orders (
    order_number VARCHAR(20) PRIMARY KEY,               -- 订单编号，如O20230610001
    guest_name VARCHAR(50) NOT NULL,                    -- 客人姓名
    phone VARCHAR(20) NOT NULL,                         -- 联系电话
    id_number VARCHAR(30) NOT NULL,                     -- 身份证号码
    room_type VARCHAR(20) NOT NULL,                     -- 房间类型代码
    room_number VARCHAR(10) NOT NULL,                   -- 房间号
    check_in_date DATE NOT NULL,                        -- 预计入住日期
    check_out_date DATE NOT NULL,                       -- 预计退房日期
    status VARCHAR(20) NOT NULL,                        -- 订单状态(待入住/已入住/已退房/已取消)
    payment_method VARCHAR(20),                         -- 支付方式(cash/wechat/alipay/creditcard)
    room_price DECIMAL(10,2) NOT NULL,                  -- 房间总价
    deposit DECIMAL(10,2),                              -- 押金
    create_time TIMESTAMP NOT NULL,                     -- 订单创建时间
    actual_check_in_time TIMESTAMP,                     -- 实际入住时间
    actual_check_out_time TIMESTAMP,                    -- 实际退房时间
    remarks TEXT,                                       -- 备注信息
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

-- 房间变更记录表 (room_changes)
CREATE TABLE room_changes (
    id SERIAL PRIMARY KEY,                              -- 记录ID
    order_number VARCHAR(20) NOT NULL,                  -- 订单编号
    change_time TIMESTAMP NOT NULL,                     -- 变更时间
    old_room VARCHAR(10) NOT NULL,                      -- 原房间号
    new_room VARCHAR(10) NOT NULL,                      -- 新房间号
    change_reason TEXT,                                 -- 变更原因
    FOREIGN KEY (order_number) REFERENCES orders(order_number),
    FOREIGN KEY (old_room) REFERENCES rooms(room_number),
    FOREIGN KEY (new_room) REFERENCES rooms(room_number)
);

-- 库存表 (inventory)
CREATE TABLE inventory (
    date DATE NOT NULL,                                 -- 日期
    type_code VARCHAR(20) NOT NULL,                     -- 房型代码
    total_rooms INT NOT NULL,                           -- 该房型总房间数
    available_rooms INT NOT NULL,                       -- 可用房间数
    price_adjustment DECIMAL(10,2) DEFAULT 0,           -- 价格调整(+/-)
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,           -- 是否关闭销售
    special_event VARCHAR(100),                         -- 特殊事件(节假日、展会等)
    min_stay INT DEFAULT 1,                             -- 最少入住天数
    PRIMARY KEY (date, type_code),                      -- 复合主键
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 添加索引以提高查询性能
CREATE INDEX idx_rooms_status ON rooms(status);                    -- 房间状态索引
CREATE INDEX idx_rooms_type ON rooms(type_code);                   -- 房间类型索引
CREATE INDEX idx_orders_status ON orders(status);                  -- 订单状态索引
CREATE INDEX idx_orders_dates ON orders(check_in_date, check_out_date); -- 入住和退房日期索引
CREATE INDEX idx_inventory_date ON inventory(date);                -- 库存日期索引

-- 插入初始房型数据
INSERT INTO room_types (type_code, type_name, base_price, max_guests, area, has_window, bed_type, description) VALUES
('standard', '标准间', 288.00, 2, 25, TRUE, '双床', '舒适的标准双人间，配备基本设施'),
('deluxe', '豪华间', 388.00, 2, 30, TRUE, '大床', '宽敞的豪华间，配备高级设施'),
('suite', '套房', 588.00, 3, 45, TRUE, '大床+加床', '高档套房，独立客厅和卧室'),
('presidential', '总统套房', 1288.00, 4, 80, TRUE, '特大床', '最高级套房，奢华配置，私人管家服务'),
('family', '家庭房', 688.00, 4, 50, TRUE, '多床', '适合家庭入住的宽敞房间，可容纳4-6人');

-- 添加示例房间数据
INSERT INTO rooms (room_number, type_code, floor, building, status, price) VALUES
('101', 'standard', 1, '主楼', 'available', 288.00),
('102', 'standard', 1, '主楼', 'available', 288.00),
('103', 'standard', 1, '主楼', 'available', 288.00),
('201', 'deluxe', 2, '主楼', 'available', 388.00),
('202', 'deluxe', 2, '主楼', 'available', 388.00),
('A201', 'deluxe', 2, 'A座', 'available', 428.00),
('A202', 'deluxe', 2, 'A座', 'available', 428.00),
('301', 'suite', 3, '主楼', 'available', 588.00),
('302', 'suite', 3, '主楼', 'available', 588.00),
('401', 'presidential', 4, '主楼', 'available', 1288.00),
('501', 'family', 5, '主楼', 'available', 688.00),
('502', 'family', 5, '主楼', 'available', 688.00);

-- 初始化库存数据
INSERT INTO inventory (date, type_code, total_rooms, available_rooms)
SELECT d.date, rt.type_code, 
       (SELECT COUNT(*) FROM rooms WHERE type_code = rt.type_code),
       (SELECT COUNT(*) FROM rooms WHERE type_code = rt.type_code AND status = 'available')
FROM (SELECT current_date + i AS date FROM generate_series(0, 30) i) d
CROSS JOIN (SELECT type_code FROM room_types) rt; 