#!/usr/bin/env node
"use strict";

/**
 * 账单表数据迁移脚本
 * 将 room_fee 和 deposit 字段拆分为独立的 change_price 记录
 *
 * 执行方式：node backend/scripts/migrateBillsTable.js
 */

const { query, getClient } = require('../database/postgreDB/pg');

/**
 * 迁移账单数据
 */
async function migrateBills() {
  const client = await getClient();

  try {
    console.log('🚀 开始账单表数据迁移...\n');

    await client.query('BEGIN');

    // 1. 添加迁移标记列
    console.log('📋 步骤 1: 添加迁移标记列 (migrated)');
    await client.query(`
      ALTER TABLE bills
      ADD COLUMN IF NOT EXISTS migrated BOOLEAN DEFAULT false
    `);
    console.log('✅ 迁移标记列添加完成\n');

    // 2. 查询所有未迁移的账单（排除已经是新格式的记录）
    console.log('📋 步骤 2: 查询待迁移的账单记录');
    const result = await client.query(`
      SELECT * FROM bills
      WHERE migrated = false
        AND (room_fee IS NOT NULL OR deposit IS NOT NULL)
      ORDER BY bill_id
    `);

    const totalRecords = result.rows.length;
    console.log(`找到 ${totalRecords} 条待迁移记录\n`);

    if (totalRecords === 0) {
      console.log('⚠️  没有需要迁移的记录，脚本结束');
      await client.query('COMMIT');
      return { success: true, migrated: 0, created: 0 };
    }

    let migratedCount = 0;
    let createdCount = 0;

    // 3. 遍历每条账单进行迁移
    console.log('📋 步骤 3: 开始迁移账单数据...');
    for (const bill of result.rows) {
      const newRecords = [];

      // 3.1 如果有房费，创建"房费"记录
      if (bill.room_fee && Number(bill.room_fee) > 0) {
        newRecords.push({
          order_id: bill.order_id,
          room_number: bill.room_number,
          guest_name: bill.guest_name,
          change_price: Number(bill.room_fee),
          change_type: '房费',
          pay_way: bill.pay_way,
          create_time: bill.create_time,
          remarks: bill.remarks,
          stay_type: bill.stay_type,
          stay_date: bill.stay_date
        });
      }

      // 3.2 如果有押金，创建"收押"记录
      if (bill.deposit && Number(bill.deposit) > 0) {
        newRecords.push({
          order_id: bill.order_id,
          room_number: bill.room_number,
          guest_name: bill.guest_name,
          change_price: Number(bill.deposit),
          change_type: '收押',
          pay_way: bill.pay_way,
          create_time: bill.create_time,
          remarks: bill.remarks,
          stay_type: bill.stay_type,
          stay_date: bill.stay_date
        });
      }

      // 3.3 如果原记录有改价金额且不是"订单账单"，保留原记录
      // "订单账单"类型的记录已经被上面的房费和押金拆分，不需要再保留
      if (bill.change_price && Number(bill.change_price) !== 0 && bill.change_type !== '订单账单') {
        newRecords.push({
          order_id: bill.order_id,
          room_number: bill.room_number,
          guest_name: bill.guest_name,
          change_price: Number(bill.change_price),
          change_type: bill.change_type || '其他',
          pay_way: bill.pay_way,
          create_time: bill.create_time,
          remarks: bill.remarks,
          stay_type: bill.stay_type,
          stay_date: bill.stay_date
        });
      }

      // 3.4 插入新记录
      for (const record of newRecords) {
        await client.query(`
          INSERT INTO bills (
            order_id, room_number, guest_name, change_price,
            change_type, pay_way, create_time, remarks,
            stay_type, stay_date, migrated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        `, [
          record.order_id,
          record.room_number,
          record.guest_name,
          record.change_price,
          record.change_type,
          record.pay_way,
          record.create_time,
          record.remarks,
          record.stay_type,
          record.stay_date
        ]);
        createdCount++;
      }

      // 3.5 标记原记录为已迁移
      await client.query(`
        UPDATE bills SET migrated = true WHERE bill_id = $1
      `, [bill.bill_id]);

      migratedCount++;

      // 每处理 100 条记录输出一次进度
      if (migratedCount % 100 === 0) {
        console.log(`   已处理: ${migratedCount}/${totalRecords} 条记录...`);
      }
    }

    console.log(`✅ 迁移完成: ${migratedCount}/${totalRecords} 条记录`);
    console.log(`📝 新创建: ${createdCount} 条账单记录\n`);

    // 4. 验证数据完整性
    console.log('📋 步骤 4: 验证数据完整性...');

    // 统计旧记录的总金额
    const oldTotalResult = await client.query(`
      SELECT
        SUM(COALESCE(room_fee, 0)) as total_room_fee,
        SUM(COALESCE(deposit, 0)) as total_deposit,
        SUM(COALESCE(change_price, 0)) as total_change_price
      FROM bills
      WHERE migrated = true AND room_fee IS NOT NULL
    `);

    // 统计新记录的总金额
    const newTotalResult = await client.query(`
      SELECT
        SUM(CASE WHEN change_type = '房费' THEN change_price ELSE 0 END) as total_room_fee,
        SUM(CASE WHEN change_type = '收押' THEN change_price ELSE 0 END) as total_deposit,
        SUM(CASE WHEN change_type NOT IN ('房费', '收押', '订单账单') THEN change_price ELSE 0 END) as total_change_price
      FROM bills
      WHERE migrated = true AND room_fee IS NULL
    `);

    const oldTotals = oldTotalResult.rows[0];
    const newTotals = newTotalResult.rows[0];

    console.log('💰 金额对比:');
    console.log(`   旧格式房费总额: ${Number(oldTotals.total_room_fee || 0).toFixed(2)}`);
    console.log(`   新格式房费总额: ${Number(newTotals.total_room_fee || 0).toFixed(2)}`);
    console.log(`   旧格式押金总额: ${Number(oldTotals.total_deposit || 0).toFixed(2)}`);
    console.log(`   新格式押金总额: ${Number(newTotals.total_deposit || 0).toFixed(2)}`);

    const roomFeeDiff = Math.abs(Number(oldTotals.total_room_fee || 0) - Number(newTotals.total_room_fee || 0));
    const depositDiff = Math.abs(Number(oldTotals.total_deposit || 0) - Number(newTotals.total_deposit || 0));

    if (roomFeeDiff < 0.01 && depositDiff < 0.01) {
      console.log('✅ 数据验证通过：金额一致\n');
    } else {
      throw new Error(`数据验证失败：金额不一致！房费差异: ${roomFeeDiff}, 押金差异: ${depositDiff}`);
    }

    await client.query('COMMIT');

    console.log('🎉 账单表迁移成功完成！\n');
    console.log('📊 迁移统计:');
    console.log(`   - 迁移原记录: ${migratedCount} 条`);
    console.log(`   - 创建新记录: ${createdCount} 条`);
    console.log(`   - 数据验证: 通过 ✓\n`);

    console.log('⚠️  注意事项:');
    console.log('   1. 旧记录已标记为 migrated=true，但未删除');
    console.log('   2. 新记录使用新格式（change_type: 房费/收押）');
    console.log('   3. 请在后端代码重构完成后，再执行删除旧字段的操作\n');

    return {
      success: true,
      migrated: migratedCount,
      created: createdCount
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error.message);
    console.error('📋 错误详情:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 回滚迁移（清理迁移数据）
 */
async function rollbackMigration() {
  const client = await getClient();

  try {
    console.log('🔄 开始回滚迁移...\n');

    await client.query('BEGIN');

    // 删除新创建的记录（migrated=true 且 room_fee IS NULL）
    const deleteResult = await client.query(`
      DELETE FROM bills
      WHERE migrated = true AND room_fee IS NULL
      RETURNING bill_id
    `);

    console.log(`✅ 已删除 ${deleteResult.rows.length} 条新创建的记录`);

    // 恢复旧记录的 migrated 标记
    await client.query(`
      UPDATE bills
      SET migrated = false
      WHERE migrated = true
    `);

    console.log('✅ 已恢复旧记录的迁移标记');

    // 删除 migrated 列（可选）
    // await client.query(`ALTER TABLE bills DROP COLUMN IF EXISTS migrated`);

    await client.query('COMMIT');

    console.log('🎉 回滚完成！\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 回滚失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 命令行执行
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rollback') {
    rollbackMigration()
      .then(() => {
        console.log('✅ 回滚操作完成');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ 回滚操作失败:', err);
        process.exit(1);
      });
  } else {
    migrateBills()
      .then(() => {
        console.log('✅ 迁移操作完成');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ 迁移操作失败:', err);
        process.exit(1);
      });
  }
}

module.exports = { migrateBills, rollbackMigration };























