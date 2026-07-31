const { query } = require('../../database/postgreDB/pg');

/**
 * 写入渠道通知；唯一消息 ID 冲突时不新增，保证渠道重试不会重复提醒。
 */
async function createNotification(notification) {
  const result = await query(
    `
      INSERT INTO system_notifications
        (source, event_type, external_message_id, title, content, level, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (external_message_id) DO NOTHING
      RETURNING id
    `,
    [
      notification.source,
      notification.eventType,
      notification.externalMessageId,
      notification.title,
      notification.content,
      notification.level,
      notification.rawPayload
    ]
  );
  return result.rows[0] || null;
}

/**
 * 读取最近通知及未读数量，铃铛只展示有限条目避免首页请求无限增长。
 */
async function listNotifications(limit) {
  const result = await query(
    `
      SELECT
        id,
        title,
        content,
        level,
        is_read,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
      FROM system_notifications
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  const unreadResult = await query(
    'SELECT COUNT(*)::int AS count FROM system_notifications WHERE is_read = FALSE'
  );
  return {
    items: result.rows,
    unreadCount: unreadResult.rows[0].count
  };
}

/**
 * 铃铛打开后统一标记已读，当前全局通知不需要区分具体员工账号。
 */
async function markAllAsRead() {
  await query('UPDATE system_notifications SET is_read = TRUE WHERE is_read = FALSE');
}

module.exports = {
  createNotification,
  listNotifications,
  markAllAsRead
};
