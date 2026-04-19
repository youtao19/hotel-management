"use strict";

const tableName = "rate_plans";

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    room_id INTEGER,
    room_type_code VARCHAR(20) REFERENCES room_types(type_code),
    name VARCHAR(255) NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    sales_type INTEGER NOT NULL DEFAULT 1,
    currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
    hourly_earliest_check_in VARCHAR(5),
    hourly_latest_check_out VARCHAR(5),
    hourly_usage_duration INTEGER,
    midnight_latest_booking_time INTEGER,
    midnight_enabled BOOLEAN NOT NULL DEFAULT false,
    douyin_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rate_plans_base_price_non_negative CHECK (base_price >= 0),
    CONSTRAINT rate_plans_status_check CHECK (status IN (0, 1)),
    CONSTRAINT rate_plans_sales_type_check CHECK (sales_type IN (1, 2, 3)),
    CONSTRAINT rate_plans_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT rate_plans_hourly_usage_duration_check CHECK (hourly_usage_duration IS NULL OR hourly_usage_duration BETWEEN 1 AND 23),
    CONSTRAINT rate_plans_midnight_booking_time_check CHECK (midnight_latest_booking_time IS NULL OR midnight_latest_booking_time BETWEEN 1 AND 6)
  );
`;

const schemaUpdateQueryStrings = [
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS room_type_code VARCHAR(20);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS sales_type INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'CNY';`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS hourly_earliest_check_in VARCHAR(5);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS hourly_latest_check_out VARCHAR(5);`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS hourly_usage_duration INTEGER;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS midnight_latest_booking_time INTEGER;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS midnight_enabled BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS douyin_config JSONB NOT NULL DEFAULT '{}';`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
  `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
  `ALTER TABLE ${tableName} ALTER COLUMN room_id DROP NOT NULL;`,
  `ALTER TABLE ${tableName} ALTER COLUMN base_price TYPE NUMERIC(10,2) USING base_price::NUMERIC(10,2);`,
  `ALTER TABLE ${tableName} ALTER COLUMN status SET DEFAULT 1;`,
  `UPDATE ${tableName} SET status = 1 WHERE status IS NULL;`,
  `ALTER TABLE ${tableName} ALTER COLUMN status SET NOT NULL;`,
  `
    UPDATE ${tableName} rp
    SET room_type_code = r.type_code
    FROM rooms r
    WHERE rp.room_type_code IS NULL
      AND rp.room_id IS NOT NULL
      AND rp.room_id = r.room_id;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_room_type_code_fkey'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_room_type_code_fkey
          FOREIGN KEY (room_type_code) REFERENCES room_types(type_code) NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_base_price_non_negative'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_base_price_non_negative CHECK (base_price >= 0) NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_status_check'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_status_check CHECK (status IN (0, 1)) NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_sales_type_check'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_sales_type_check CHECK (sales_type IN (1, 2, 3)) NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_currency_check'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_currency_check CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_hourly_usage_duration_check'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_hourly_usage_duration_check
          CHECK (hourly_usage_duration IS NULL OR hourly_usage_duration BETWEEN 1 AND 23) NOT VALID;
      END IF;
    END $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_midnight_booking_time_check'
      ) THEN
        ALTER TABLE ${tableName}
          ADD CONSTRAINT rate_plans_midnight_booking_time_check
          CHECK (midnight_latest_booking_time IS NULL OR midnight_latest_booking_time BETWEEN 1 AND 6) NOT VALID;
      END IF;
    END $$;
  `
];

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_rate_plans_room_type_code ON ${tableName} (room_type_code);`,
  `CREATE INDEX IF NOT EXISTS idx_rate_plans_status ON ${tableName} (status);`,
  `CREATE INDEX IF NOT EXISTS idx_rate_plans_sales_type ON ${tableName} (sales_type);`,
  `CREATE INDEX IF NOT EXISTS idx_rate_plans_currency ON ${tableName} (currency);`,
  `CREATE INDEX IF NOT EXISTS idx_rate_plans_updated_at ON ${tableName} (updated_at);`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '本地售卖套餐表，用于维护可同步到抖音预定商品的数据';`,
  `COMMENT ON COLUMN ${tableName}.room_id IS '历史字段：旧版套餐曾绑定到具体房间，新接口不再写入';`,
  `COMMENT ON COLUMN ${tableName}.room_type_code IS '本地房型编码，售卖套餐按房型维护';`,
  `COMMENT ON COLUMN ${tableName}.sales_type IS '抖音售卖形式：1全日房，2钟点房，3凌晨房';`,
  `COMMENT ON COLUMN ${tableName}.douyin_config IS '抖音扩展配置，存放后续不适合频繁拆列的字段';`
];

const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;

const table = {
  tableName,
  createQuery,
  createIndexQueryStrings,
  createCommentQueryStrings,
  schemaUpdateQueryStrings,
  dropQuery
};

module.exports = table;
