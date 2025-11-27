/**
 * 订单表迁移脚本 - 支持多日分行
 *
 * 此脚本将现有的 orders 表迁移到新的多日分行结构：
 * 1. 添加 id SERIAL 主键（如果不存在）
 * 2. 添加 stay_date DATE 列（如果不存在）
 * 3. order_id 不再是主键，变为普通索引（分组ID）
 * 4. 移除 prepaid_at 列（押金逻辑移到 bills 表）
 * 5. 创建唯一约束：(guest_name, room_number, stay_date, stay_type) WHERE status NOT IN (...)
 * 6. 将现有多日订单拆分为多行
 */

const db = require('../database/postgreDB/pg');

async function migrate() {
  console.log('🚀 开始订单表迁移 - 支持多日分行...');
  db.createPool();
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    console.log('📝 事务开始');

    // 1. 检查当前表结构
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
      ORDER BY ordinal_position
    `);

    const existingColumns = new Set(columnsResult.rows.map(r => r.column_name));
    console.log('📋 现有列:', Array.from(existingColumns).join(', '));

    // 2. 检查是否已有 id 列
    const hasIdColumn = existingColumns.has('id');
    const hasStayDateColumn = existingColumns.has('stay_date');
    const hasPrepaidAtColumn = existingColumns.has('prepaid_at');

    // 3. 备份现有数据（用于拆分多日订单）
    console.log('💾 备份现有订单数据...');
    const backupResult = await client.query(`
      SELECT * FROM orders
      WHERE check_out_date > check_in_date
        OR (check_out_date = check_in_date AND stay_type = '休息房')
      ORDER BY create_time
    `);
    const existingOrders = backupResult.rows;
    console.log(`📊 找到 ${existingOrders.length} 条需要处理的订单`);

    // 4. 如果表结构需要大幅修改，创建新表并迁移数据
    if (!hasIdColumn || !hasStayDateColumn) {
      console.log('🔧 需要重构表结构...');

      // 4.1 重命名原表
      await client.query('ALTER TABLE orders RENAME TO orders_old');
      console.log('✅ 原表已重命名为 orders_old');

      // 4.2 删除原表的外键约束引用
      await client.query(`
        ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_order_id_fkey;
        ALTER TABLE review_invitations DROP CONSTRAINT IF EXISTS review_invitations_order_id_fkey;
        ALTER TABLE order_changes DROP CONSTRAINT IF EXISTS order_changes_order_id_fkey;
      `);
      console.log('✅ 已移除外键约束');

      // 4.3 创建新表
      await client.query(`
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(50) NOT NULL,
          id_source VARCHAR(50),
          order_source VARCHAR(20) NOT NULL,
          guest_name VARCHAR(50) NOT NULL,
          phone VARCHAR(20),
          room_type VARCHAR(20) NOT NULL,
          room_number VARCHAR(20) NOT NULL,
          check_in_date DATE NOT NULL,
          check_out_date DATE NOT NULL,
          stay_date DATE NOT NULL,
          status VARCHAR(20) NOT NULL,
          payment_method VARCHAR(20),
          total_price NUMERIC(10, 2),
          deposit DECIMAL(10,2) DEFAULT 0,
          is_prepaid BOOLEAN NOT NULL DEFAULT FALSE,
          prepaid_amount NUMERIC(10,2) DEFAULT 0,
          create_time TIMESTAMP NOT NULL,
          stay_type TEXT,
          remarks TEXT,
          FOREIGN KEY (room_type) REFERENCES room_types(type_code),
          FOREIGN KEY (room_number) REFERENCES rooms(room_number)
        )
      `);
      console.log('✅ 新表已创建');

      // 4.4 创建索引
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_check_dates ON orders(check_in_date, check_out_date);
        CREATE INDEX IF NOT EXISTS idx_orders_stay_date ON orders(stay_date);
        CREATE INDEX IF NOT EXISTS idx_orders_create_time ON orders(create_time DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_guest_stay ON orders
          (guest_name, room_number, stay_date, stay_type)
          WHERE status NOT IN ('cancelled', 'checked-out');
      `);
      console.log('✅ 索引已创建');

      // 4.5 迁移数据 - 将多日订单拆分为多行
      console.log('📤 开始迁移数据...');
      let migratedCount = 0;
      let expandedCount = 0;

      for (const order of existingOrders) {
        const checkInDate = new Date(order.check_in_date);
        const checkOutDate = new Date(order.check_out_date);

        // 计算住宿天数
        let stayDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

        // 休息房（同日入住退房）按1天处理
        if (stayDays === 0) {
          stayDays = 1;
        }

        // 计算每日价格
        const totalPrice = parseFloat(order.total_price) || 0;
        const dailyPrice = stayDays > 0 ? Number((totalPrice / stayDays).toFixed(2)) : totalPrice;

        // 为每一天创建一行记录
        for (let i = 0; i < stayDays; i++) {
          const stayDate = new Date(checkInDate);
          stayDate.setDate(stayDate.getDate() + i);
          const stayDateStr = stayDate.toISOString().split('T')[0];

          // 只在第一天设置押金
          const dayDeposit = i === 0 ? (parseFloat(order.deposit) || 0) : 0;

          await client.query(`
            INSERT INTO orders (
              order_id, id_source, order_source, guest_name, phone,
              room_type, room_number, check_in_date, check_out_date,
              stay_date, status, payment_method, total_price, deposit,
              is_prepaid, prepaid_amount, create_time, stay_type, remarks
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
          `, [
            order.order_id,
            order.id_source,
            order.order_source,
            order.guest_name,
            order.phone,
            order.room_type,
            order.room_number,
            order.check_in_date,
            order.check_out_date,
            stayDateStr,
            order.status,
            order.payment_method,
            dailyPrice,
            dayDeposit,
            order.is_prepaid || false,
            i === 0 ? (parseFloat(order.prepaid_amount) || 0) : 0,
            order.create_time,
            order.stay_type,
            order.remarks
          ]);

          expandedCount++;
        }
        migratedCount++;
      }

      console.log(`✅ 数据迁移完成: ${migratedCount} 条订单 -> ${expandedCount} 条每日记录`);

      // 4.6 删除旧表
      await client.query('DROP TABLE orders_old CASCADE');
      console.log('✅ 旧表已删除');

    } else if (hasPrepaidAtColumn) {
      // 只需要移除 prepaid_at 列
      console.log('🔧 移除 prepaid_at 列...');
      await client.query('ALTER TABLE orders DROP COLUMN IF EXISTS prepaid_at');
      console.log('✅ prepaid_at 列已移除');
    }

    await client.query('COMMIT');
    console.log('✅ 迁移完成！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// 检查是否直接运行此脚本
if (require.main === module) {
  migrate().catch(err => {
    console.error('迁移脚本执行失败:', err);
    process.exit(1);
  });
}

module.exports = { migrate };
