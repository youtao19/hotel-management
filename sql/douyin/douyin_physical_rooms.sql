CREATE TABLE IF NOT EXISTS douyin_physical_rooms (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  room_id VARCHAR(64) NOT NULL UNIQUE,
  room_name VARCHAR(255),
  status INTEGER,
  audit_message TEXT,
  rate_plan_list JSONB,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE douyin_physical_rooms IS '抖音物理房型原始缓存表';
COMMENT ON COLUMN douyin_physical_rooms.account_id IS '抖音账号ID';
COMMENT ON COLUMN douyin_physical_rooms.room_id IS '抖音物理房型ID';
COMMENT ON COLUMN douyin_physical_rooms.room_name IS '抖音物理房型名称';
COMMENT ON COLUMN douyin_physical_rooms.status IS '抖音物理房型状态';
COMMENT ON COLUMN douyin_physical_rooms.audit_message IS '审核信息';
COMMENT ON COLUMN douyin_physical_rooms.rate_plan_list IS '价格计划列表';
COMMENT ON COLUMN douyin_physical_rooms.raw_payload IS '抖音原始房型对象';

CREATE TABLE IF NOT EXISTS douyin_room_type_mapping (
  id BIGSERIAL PRIMARY KEY,
  douyin_room_id VARCHAR(64) NOT NULL UNIQUE,
  douyin_room_name VARCHAR(255),
  local_room_type VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE douyin_room_type_mapping IS '抖音房型到本地房型映射表';
COMMENT ON COLUMN douyin_room_type_mapping.douyin_room_id IS '抖音物理房型ID';
COMMENT ON COLUMN douyin_room_type_mapping.douyin_room_name IS '抖音物理房型名称';
COMMENT ON COLUMN douyin_room_type_mapping.local_room_type IS '本地系统房型编码';
