const { query } = require('../pg');

/**
 * 测试环境的数据库迁移脚本
 * 在测试运行前确保数据库结构是最新的
 */

async function migrateTestDatabase() {
  console.log('开始测试数据库迁移...');

  try {
    // 1. 检查当前 room_price 字段类型
    const checkTypeResult = await query(`
      SELECT data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name = 'room_price'
      AND table_schema = 'public'
    `);

    if (checkTypeResult.rows.length === 0) {
      console.log('❌ orders 表中没有找到 room_price 字段，可能表未创建');
      return false;
    }

    const currentType = checkTypeResult.rows[0].data_type;
    console.log(`当前 room_price 字段类型: ${currentType}`);

    // 2. 如果已经是 jsonb 类型，跳过迁移
    if (currentType === 'jsonb') {
      console.log('✅ room_price 字段已经是 jsonb 类型，无需迁移');
      return true;
    }

    // 3. 执行迁移
    console.log('📋 开始执行类型转换...');

    // 创建临时列
    await query('ALTER TABLE orders ADD COLUMN room_price_temp JSONB');

    // 转换现有数据
    const ordersResult = await query(`
      SELECT order_id, room_price, check_in_date
      FROM orders
      WHERE room_price IS NOT NULL
    `);

    console.log(`需要转换 ${ordersResult.rows.length} 条记录`);

    for (const order of ordersResult.rows) {
      const price = parseFloat(order.room_price);
      const checkInDate = new Date(order.check_in_date).toISOString().split('T')[0];
      const priceJson = { [checkInDate]: price };

      await query(
        'UPDATE orders SET room_price_temp = $1 WHERE order_id = $2',
        [JSON.stringify(priceJson), order.order_id]
      );
    }

    // 删除原字段并重命名
    await query('ALTER TABLE orders DROP COLUMN room_price');
    await query('ALTER TABLE orders RENAME COLUMN room_price_temp TO room_price');

    // 添加约束和索引
    await query(`
      ALTER TABLE orders
      ADD CONSTRAINT chk_room_price_json
      CHECK (jsonb_typeof(room_price) = 'object')
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_orders_room_price_gin ON orders USING GIN (room_price)');

    // 设置 NOT NULL
    await query('ALTER TABLE orders ALTER COLUMN room_price SET NOT NULL');

    console.log('✅ 测试数据库迁移完成');
    return true;

  } catch (error) {
    console.error('❌ 测试数据库迁移失败:', error.message);
    return false;
  }
}

module.exports = { migrateTestDatabase };
