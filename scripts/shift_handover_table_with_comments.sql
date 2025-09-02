-- SQL script to create the shift_handover table with comments for each column.
-- This script includes proposed changes for status, handover_person, receive_person, and task_list fields.

-- Drop the table if it already exists to allow for recreation
DROP TABLE IF EXISTS shift_handover;

-- Create the shift_handover table
CREATE TABLE IF NOT EXISTS shift_handover (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'hotel',
  details JSONB NOT NULL DEFAULT '[]',
  statistics JSONB NOT NULL DEFAULT '{}',
  remarks TEXT,
  task_list JSONB DEFAULT '[]'::jsonb,
  cashier_name VARCHAR(100) NOT NULL,
  shift_time VARCHAR(10) NOT NULL,
  shift_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  handover_person VARCHAR(100),
  receive_person VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shift_date, status)
);

-- Add comments to the table and its columns for documentation
COMMENT ON TABLE shift_handover IS '酒店交接班记录表';

COMMENT ON COLUMN shift_handover.id IS '交接班记录唯一ID';
COMMENT ON COLUMN shift_handover.type IS '交接班类型 (例如: hotel)';
COMMENT ON COLUMN shift_handover.details IS '交接班详细数据，JSONB格式，包含支付明细等';
COMMENT ON COLUMN shift_handover.statistics IS '交接班统计数据，JSONB格式，包含房间数、好评等';
COMMENT ON COLUMN shift_handover.remarks IS '交接班备注信息';
COMMENT ON COLUMN shift_handover.task_list IS '交接班备忘录列表，JSONB格式';
COMMENT ON COLUMN shift_handover.cashier_name IS '收银员姓名';
COMMENT ON COLUMN shift_handover.shift_time IS '交接班时间 (例如: 08:00)';
COMMENT ON COLUMN shift_handover.shift_date IS '交接班日期';
COMMENT ON COLUMN shift_handover.status IS '交接班记录状态 (draft: 草稿, finalized: 已完成)';
COMMENT ON COLUMN shift_handover.handover_person IS '交班人姓名';
COMMENT ON COLUMN shift_handover.receive_person IS '接班人姓名';
COMMENT ON COLUMN shift_handover.created_at IS '记录创建时间';
COMMENT ON COLUMN shift_handover.updated_at IS '记录最后更新时间';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shift_handover_date ON shift_handover(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_handover_type ON shift_handover(type);
CREATE INDEX IF NOT EXISTS idx_shift_handover_cashier ON shift_handover(cashier_name);
