const { query } = require('../pg');

/**
 * 将 orders 表的 room_price 字段从 DECIMAL 改为 JSONB
 * 迁移脚本：update_room_price_to_jsonb
 */

async function up() {
  console.log('开始迁移：将 room_price 字段从 DECIMAL 改为 JSONB...');

  try {
    // 1. 检查当前表结构
    console.log('1. 检查当前 room_price 字段类型...');
    const checkTypeResult = await query(`
      SELECT data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name = 'room_price'
      AND table_schema = 'public'
    `);

    if (checkTypeResult.rows.length === 0) {
      throw new Error('orders 表中没有找到 room_price 字段');
    }

    console.log('当前字段类型:', checkTypeResult.rows[0]);

    // 2. 如果已经是 jsonb 类型，跳过迁移
    if (checkTypeResult.rows[0].data_type === 'jsonb') {
      console.log('✅ room_price 字段已经是 jsonb 类型，无需迁移');
      return;
    }

    // 3. 备份现有数据（转换为 JSON 格式）
    console.log('2. 备份并转换现有数据...');

    // 首先检查是否有数据
    const dataCountResult = await query('SELECT COUNT(*) as count FROM orders');
    const dataCount = parseInt(dataCountResult.rows[0].count);
    console.log(`发现 ${dataCount} 条订单记录`);

    if (dataCount > 0) {
      // 获取所有订单数据
      const ordersResult = await query(`
        SELECT order_id, room_price, check_in_date, check_out_date
        FROM orders
        WHERE room_price IS NOT NULL
      `);

      console.log(`需要转换 ${ordersResult.rows.length} 条有价格数据的记录`);

      // 4. 添加临时列来存储转换后的数据
      console.log('3. 创建临时列...');
      await query('ALTER TABLE orders ADD COLUMN room_price_temp JSONB');

      // 5. 转换数据：将单个价格转换为 {check_in_date: price} 格式
      console.log('4. 转换价格数据格式...');
      for (const order of ordersResult.rows) {
        const price = parseFloat(order.room_price);
        const checkInDate = new Date(order.check_in_date).toISOString().split('T')[0];
        const priceJson = { [checkInDate]: price };

        await query(
          'UPDATE orders SET room_price_temp = $1 WHERE order_id = $2',
          [JSON.stringify(priceJson), order.order_id]
        );
      }

      console.log('✅ 数据转换完成');
    }

    // 6. 删除原字段
    console.log('5. 删除原 room_price 字段...');
    await query('ALTER TABLE orders DROP COLUMN room_price');

    // 7. 重命名临时字段
    console.log('6. 重命名临时字段...');
    await query('ALTER TABLE orders RENAME COLUMN room_price_temp TO room_price');

    // 8. 添加约束和索引
    console.log('7. 添加约束和索引...');
    await query(`
      ALTER TABLE orders
      ADD CONSTRAINT chk_room_price_json
      CHECK (jsonb_typeof(room_price) = 'object')
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_orders_room_price_gin ON orders USING GIN (room_price)');

    // 9. 更新字段为 NOT NULL（如果原来是 NOT NULL）
    const originalIsNullable = checkTypeResult.rows[0].is_nullable;
    if (originalIsNullable === 'NO') {
      console.log('8. 设置字段为 NOT NULL...');
      await query('ALTER TABLE orders ALTER COLUMN room_price SET NOT NULL');
    }

    console.log('✅ 迁移完成！room_price 字段已成功转换为 JSONB 类型');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

async function down() {
  console.log('开始回滚：将 room_price 字段从 JSONB 改回 DECIMAL...');

  try {
    // 1. 检查当前字段类型
    const checkTypeResult = await query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name = 'room_price'
      AND table_schema = 'public'
    `);

    if (checkTypeResult.rows[0].data_type !== 'jsonb') {
      console.log('✅ room_price 字段不是 jsonb 类型，无需回滚');
      return;
    }

    // 2. 添加临时列
    await query('ALTER TABLE orders ADD COLUMN room_price_temp DECIMAL(10,2)');

    // 3. 转换数据回 DECIMAL 格式（取第一个价格值）
    const ordersResult = await query(`
      SELECT order_id, room_price
      FROM orders
      WHERE room_price IS NOT NULL
    `);

    for (const order of ordersResult.rows) {
      const priceObj = order.room_price;
      const firstPrice = Object.values(priceObj)[0] || 0;
      await query(
        'UPDATE orders SET room_price_temp = $1 WHERE order_id = $2',
        [firstPrice, order.order_id]
      );
    }

    // 4. 删除 JSONB 字段
    await query('ALTER TABLE orders DROP COLUMN room_price');

    // 5. 重命名临时字段
    await query('ALTER TABLE orders RENAME COLUMN room_price_temp TO room_price');

    console.log('✅ 回滚完成！room_price 字段已恢复为 DECIMAL 类型');

  } catch (error) {
    console.error('❌ 回滚失败:', error);
    throw error;
  }
}

// 导出迁移函数
module.exports = { up, down };

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    try {
      await up();
      process.exit(0);
    } catch (error) {
      console.error('迁移执行失败:', error);
      process.exit(1);
    }
  })();
}
