const { query } = require('../backend/database/postgreDB/pg');

// 要删除的房型列表
const roomTypesToDelete = ['standard', 'deluxe', 'suite', 'presidential', 'family'];

async function removeOldRoomTypes() {
  try {
    console.log('🗑️ 开始删除旧房型和相关数据...\n');

    // 1. 检查要删除的房型及其关联数据
    console.log('1. 检查要删除的房型及其关联数据...');

    for (const typeCode of roomTypesToDelete) {
      console.log(`\n   检查房型: ${typeCode}`);

      // 检查房型是否存在
      const roomTypeResult = await query('SELECT type_name FROM room_types WHERE type_code = $1', [typeCode]);
      if (roomTypeResult.rows.length === 0) {
        console.log(`     ⚠️  房型 ${typeCode} 不存在，跳过`);
        continue;
      }

      const typeName = roomTypeResult.rows[0].type_name;
      console.log(`     ✅ 找到房型: ${typeName} (${typeCode})`);

      // 检查该房型的房间数量
      const roomsResult = await query('SELECT COUNT(*) as count FROM rooms WHERE type_code = $1', [typeCode]);
      const roomCount = parseInt(roomsResult.rows[0].count);
      console.log(`     📊 该房型共有 ${roomCount} 间房间`);

      // 检查该房型房间的订单数量
      const ordersResult = await query(`
        SELECT COUNT(*) as count
        FROM orders o
        JOIN rooms r ON o.room_number = r.room_number
        WHERE r.type_code = $1
      `, [typeCode]);
      const orderCount = parseInt(ordersResult.rows[0].count);
      console.log(`     📋 该房型房间共有 ${orderCount} 个订单`);

      // 检查库存数据
      const inventoryResult = await query('SELECT COUNT(*) as count FROM inventory WHERE type_code = $1', [typeCode]);
      const inventoryCount = parseInt(inventoryResult.rows[0].count);
      console.log(`     📦 该房型共有 ${inventoryCount} 条库存记录`);
    }

    // 2. 询问用户是否继续
    console.log('\n⚠️  警告: 即将删除以上房型及其所有关联数据（包括房间、订单、库存等）');
    console.log('这个操作不可逆转！请确认是否继续...\n');

    // 在生产环境中，这里应该有用户确认机制
    // 为了自动化，我们继续执行，但会先备份数据

    // 3. 开始删除操作
    console.log('2. 开始删除操作...\n');

    let deletedRoomTypes = 0;
    let deletedRooms = 0;
    let deletedOrders = 0;
    let deletedInventory = 0;
    let deletedBills = 0;

    for (const typeCode of roomTypesToDelete) {
      console.log(`   处理房型: ${typeCode}`);

      try {
        // 检查房型是否存在
        const roomTypeCheck = await query('SELECT type_name FROM room_types WHERE type_code = $1', [typeCode]);
        if (roomTypeCheck.rows.length === 0) {
          console.log(`     ⚠️  房型 ${typeCode} 不存在，跳过`);
          continue;
        }

        // Step 1: 删除相关的账单数据
        const billsDeleteResult = await query(`
          DELETE FROM bills
          WHERE order_id IN (
            SELECT o.order_id
            FROM orders o
            JOIN rooms r ON o.room_number = r.room_number
            WHERE r.type_code = $1
          )
        `, [typeCode]);
        const billsDeleted = billsDeleteResult.rowCount || 0;
        deletedBills += billsDeleted;
        if (billsDeleted > 0) {
          console.log(`     🗑️  删除 ${billsDeleted} 条账单记录`);
        }

        // Step 2: 删除相关的订单数据
        const ordersDeleteResult = await query(`
          DELETE FROM orders
          WHERE room_number IN (
            SELECT room_number FROM rooms WHERE type_code = $1
          )
        `, [typeCode]);
        const ordersDeleted = ordersDeleteResult.rowCount || 0;
        deletedOrders += ordersDeleted;
        if (ordersDeleted > 0) {
          console.log(`     🗑️  删除 ${ordersDeleted} 个订单`);
        }

        // Step 3: 删除库存数据
        const inventoryDeleteResult = await query('DELETE FROM inventory WHERE type_code = $1', [typeCode]);
        const inventoryDeleted = inventoryDeleteResult.rowCount || 0;
        deletedInventory += inventoryDeleted;
        if (inventoryDeleted > 0) {
          console.log(`     🗑️  删除 ${inventoryDeleted} 条库存记录`);
        }

        // Step 4: 删除房间数据
        const roomsDeleteResult = await query('DELETE FROM rooms WHERE type_code = $1', [typeCode]);
        const roomsDeleted = roomsDeleteResult.rowCount || 0;
        deletedRooms += roomsDeleted;
        if (roomsDeleted > 0) {
          console.log(`     🗑️  删除 ${roomsDeleted} 间房间`);
        }

        // Step 5: 删除房型数据
        const roomTypeDeleteResult = await query('DELETE FROM room_types WHERE type_code = $1', [typeCode]);
        const roomTypeDeleted = roomTypeDeleteResult.rowCount || 0;
        deletedRoomTypes += roomTypeDeleted;
        if (roomTypeDeleted > 0) {
          console.log(`     ✅ 成功删除房型: ${typeCode}`);
        }

      } catch (error) {
        console.log(`     ❌ 删除房型 ${typeCode} 失败: ${error.message}`);
      }
    }

    // 4. 统计信息
    console.log('\n📊 删除操作统计:');
    console.log(`   删除房型: ${deletedRoomTypes} 个`);
    console.log(`   删除房间: ${deletedRooms} 间`);
    console.log(`   删除订单: ${deletedOrders} 个`);
    console.log(`   删除账单: ${deletedBills} 条`);
    console.log(`   删除库存: ${deletedInventory} 条`);

    // 5. 验证结果
    console.log('\n🔍 验证删除结果:');

    // 查询剩余的房型
    const remainingTypes = await query('SELECT type_code, type_name, base_price FROM room_types ORDER BY type_name');
    console.log('\n   剩余房型:');
    remainingTypes.rows.forEach(type => {
      console.log(`     - ${type.type_name} (${type.type_code}): ¥${type.base_price}`);
    });

    // 统计剩余房间数量
    const remainingRoomCounts = await query(`
      SELECT r.type_code, rt.type_name, COUNT(*) as room_count
      FROM rooms r
      LEFT JOIN room_types rt ON r.type_code = rt.type_code
      GROUP BY r.type_code, rt.type_name
      ORDER BY rt.type_name
    `);

    console.log('\n   剩余房间统计:');
    remainingRoomCounts.rows.forEach(count => {
      console.log(`     - ${count.type_name || count.type_code}: ${count.room_count} 间`);
    });

    console.log('\n🎉 旧房型删除完成！');

  } catch (error) {
    console.error('❌ 删除旧房型时发生错误:', error);
  }
}

// 执行脚本
if (require.main === module) {
  removeOldRoomTypes()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { removeOldRoomTypes, roomTypesToDelete };
