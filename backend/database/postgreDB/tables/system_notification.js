"use strict";

const tableName = 'system_notifications';

const createQuery = `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(32) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    external_message_id VARCHAR(128) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    level VARCHAR(16) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const createIndexQueryStrings = [
  `CREATE INDEX IF NOT EXISTS idx_system_notifications_unread ON ${tableName} (is_read, created_at DESC);`
];

const createCommentQueryStrings = [
  `COMMENT ON TABLE ${tableName} IS '后台全局运营通知，保存需要管理员关注的外部渠道事件';`,
  `COMMENT ON COLUMN ${tableName}.external_message_id IS '外部渠道消息唯一标识，用于跨重试去重';`
];

module.exports = {
  tableName,
  createQuery,
  createIndexQueryStrings,
  createCommentQueryStrings
};
