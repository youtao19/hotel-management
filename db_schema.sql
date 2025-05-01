-- 房型表 (room_types) - 存储不同类型房间的基本信息
CREATE TABLE room_types (
    type_code VARCHAR(20) PRIMARY KEY,  -- 房型代码（如standard/deluxe/suite/presidential/family）
    type_name VARCHAR(50) NOT NULL,     -- 房型名称（如标准间/豪华间/套房/总统套房/家庭房）
    base_price DECIMAL(10,2) NOT NULL,  -- 基础价格（每晚）
    max_guests INT NOT NULL,            -- 最大容纳人数
    area INT,                           -- 房间面积（平方米）
    has_window BOOLEAN NOT NULL,        -- 是否有窗
    bed_type VARCHAR(20) NOT NULL,      -- 床型（大床/双床/多床）
    description TEXT,                   -- 房型描述
    amenities TEXT,                     -- 设施和服务
    image_url VARCHAR(255)              -- 房型图片URL
);

-- 房间表 (rooms) - 存储具体房间的信息
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,         -- 房间ID（自增）
    room_number VARCHAR(10) NOT NULL,   -- 房间号码
    type_code VARCHAR(20) NOT NULL,     -- 房间类型代码（关联房型表）
    floor INT NOT NULL,                 -- 楼层
    status VARCHAR(20) NOT NULL,        -- 房间状态（可用/已占用/已预订/清洁中/维护中）
    price DECIMAL(10,2) NOT NULL,       -- 当前定价（可能会根据季节调整）
    current_guest VARCHAR(50),          -- 当前入住客人姓名
    check_out_date DATE,                -- 预计退房日期
    last_cleaned TIMESTAMP,             -- 最后清扫时间
    maintenance_notes TEXT,             -- 维修记录
    building VARCHAR(10),               -- 楼栋（如A座）
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 订单表 (orders) - 存储客人订单信息
CREATE TABLE orders (
    order_id VARCHAR(20) PRIMARY KEY,   -- 订单编号，如O20230610001
    guest_name VARCHAR(50) NOT NULL,    -- 客人姓名
    phone VARCHAR(20) NOT NULL,         -- 联系电话
    id_number VARCHAR(30) NOT NULL,     -- 身份证号码
    room_type VARCHAR(20) NOT NULL,     -- 房间类型代码（关联房型表）
    room_number VARCHAR(10) NOT NULL,   -- 房间号（关联房间表）
    check_in_date DATE NOT NULL,        -- 预计入住日期
    check_out_date DATE NOT NULL,       -- 预计退房日期
    status VARCHAR(10) NOT NULL,        -- 订单状态（待入住/已入住/已退房/已取消）
    payment_method VARCHAR(10),         -- 支付方式（现金/微信/支付宝/信用卡）
    room_price DECIMAL(10,2) NOT NULL,  -- 房间总价
    deposit DECIMAL(10,2),              -- 押金
    create_time TIMESTAMP NOT NULL,     -- 订单创建时间
    actual_check_in_time TIMESTAMP,     -- 实际入住时间
    actual_check_out_time TIMESTAMP,    -- 实际退房时间
    remarks TEXT,                       -- 备注信息
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

-- 库存表 (inventory) - 存储每日房型可用情况
CREATE TABLE inventory (
    date DATE NOT NULL,                 -- 日期
    type_code VARCHAR(20) NOT NULL,     -- 房型代码（关联房型表）
    total_rooms INT NOT NULL,           -- 该房型总房间数
    available_rooms INT NOT NULL,       -- 可用房间数
    price_adjustment DECIMAL(10,2),     -- 价格调整（+/-）
    is_closed BOOLEAN NOT NULL,         -- 是否关闭销售
    special_event VARCHAR(100),         -- 特殊事件（节假日、展会等）
    min_stay INT,                       -- 最少入住天数
    PRIMARY KEY (date, type_code),      -- 复合主键（日期+房型）
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

-- 添加索引以提高查询性能
CREATE INDEX idx_orders_status ON orders(status);             -- 订单状态索引
CREATE INDEX idx_orders_check_dates ON orders(check_in_date, check_out_date); -- 入住和退房日期索引
CREATE INDEX idx_rooms_status ON rooms(status);               -- 房间状态索引
CREATE INDEX idx_rooms_type ON rooms(type_code);              -- 房间类型索引
CREATE INDEX idx_inventory_date ON inventory(date);           -- 库存日期索引 