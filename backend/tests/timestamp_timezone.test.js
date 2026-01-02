/**
 * 测试时间字段类型是否正确使用 TIMESTAMPTZ
 * 确保建表文件中的时间点字段都使用带时区的时间戳类型
 */
const { query } = require('../database/postgreDB/pg');

describe('PostgreSQL 时间字段类型规范测试', () => {

  // 需要检查的时间点字段（应为 TIMESTAMPTZ）
  const timestamptzFields = [
    { table: 'orders', column: 'create_time' },
    { table: 'bills', column: 'create_time' },
    { table: 'review_invitations', column: 'invite_time' },
    { table: 'review_invitations', column: 'update_time' },
    { table: 'dashboard_memos', column: 'created_at' },
    { table: 'dashboard_memos', column: 'updated_at' },
    { table: 'order_changes', column: 'changed_at' },
    { table: 'account', column: 'created_at' },
  ];

  // 需要检查的日期字段（应为 DATE）
  const dateFields = [
    { table: 'orders', column: 'check_in_date' },
    { table: 'orders', column: 'check_out_date' },
    { table: 'orders', column: 'stay_date' },
    { table: 'bills', column: 'stay_date' },
    { table: 'handover', column: 'date' },
    { table: 'dashboard_memos', column: 'memo_date' },
  ];

  test('所有时间点字段应使用 TIMESTAMPTZ 类型', async () => {
    for (const { table, column } of timestamptzFields) {
      const result = await query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('timestamp with time zone');
    }
  });

  test('所有业务日期字段应使用 DATE 类型', async () => {
    for (const { table, column } of dateFields) {
      const result = await query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('date');
    }
  });

  test('时间点字段不应使用无时区的 TIMESTAMP', async () => {
    // 检查是否有任何时间字段错误使用了 timestamp without time zone
    const result = await query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'timestamp without time zone'
        AND column_name IN ('create_time', 'created_at', 'updated_at', 'changed_at', 'invite_time', 'update_time')
    `);

    if (result.rows.length > 0) {
      console.log('发现使用无时区时间戳的字段:', result.rows);
    }

    expect(result.rows.length).toBe(0);
  });

  test('orders.create_time 应有默认值 now()', async () => {
    const result = await query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'create_time'
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].column_default).toMatch(/now\(\)/i);
  });

  test('bills.create_time 应有默认值 now()', async () => {
    const result = await query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'bills' AND column_name = 'create_time'
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].column_default).toMatch(/now\(\)/i);
  });
});

