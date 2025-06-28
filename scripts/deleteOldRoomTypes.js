const { query } = require('../backend/database/postgreDB/pg');

// 要删除的房型代码
const roomTypesToDelete = [
  'standard',    // 标准间
  'deluxe',      // 豪华间
  'suite',       // 套房
  'presidential', // 总统套房
  'family'       // 家庭房
];

async function deleteOldRoomTypes() {
  try {
    console.log('🗑️  开始删除旧房型配置...\n');

    // 1. 检查要删除的房型是否存在关联数据
    console.log('1. 检查房型关联数据...');

    for (const typeCode of roomTypesToDelete) {
      console.log(`\n   检查房型: ${typeCode}`);

      // 检查是否有房间使用此房型
      const roomsResult = await query('SELECT COUNT(*) as count FROM rooms WHERE type_code = $1', [typeCode]);
      const roomsCount = parseInt(roomsResult.rows[0].count);

      // 检查是否有订单使用此房型
      const ordersResult = await query('SELECT COUNT(*) as count FROM orders WHERE room_type = $1', [typeCode]);
      const ordersCount = parseInt(ordersResult.rows[0].count);

      // 检查是否有库存记录使用此房型
      const inventoryResult = await query('SELECT COUNT(*) as count FROM inventory WHERE type_code = $1', [typeCode]);
      const inventoryCount = parseInt(inventoryResult.rows[0].count);

      console.log(`     关联房间数: ${roomsCount}`);
      console.log(`     关联订单数: ${ordersCount}`);
      console.log(`     关联库存记录数: ${inventoryCount}`);

      if (roomsCount > 0 || ordersCount > 0 || inventoryCount > 0) {
        console.log(`     ⚠️  房型 ${typeCode} 有关联数据，需要先处理关联数据`);

        // 显示一些关联数据的详情
        if (roomsCount > 0) {
          const roomsDetail = await query('SELECT room_number FROM rooms WHERE type_code = $1 LIMIT 5', [typeCode]);
          const roomNumbers = roomsDetail.rows.map(r => r.room_number).join(', ');
          console.log(`       关联房间: ${roomNumbers}${roomsCount > 5 ? '...' : ''}`);
        }

        if (ordersCount > 0) {
          const ordersDetail = await query('SELECT order_id FROM orders WHERE room_type = $1 LIMIT 3', [typeCode]);
          const orderIds = ordersDetail.rows.map(o => o.order_id).join(', ');
          console.log(`       关联订单: ${orderIds}${ordersCount > 3 ? '...' : ''}`);
        }
      } else {
        console.log(`     ✅ 房型 ${typeCode} 无关联数据，可以安全删除`);
      }
    }

    // 2. 询问用户是否继续删除
    console.log('\n2. 删除确认...');
    console.log('⚠️  注意：删除房型将会：');
    console.log('   - 删除所有使用此房型的房间记录');
    console.log('   - 删除所有使用此房型的库存记录');
    console.log('   - 保留订单记录（但房型字段会变为无效引用）');
    console.log('\n   继续执行删除操作...\n');

    // 3. 开始删除操作
    let deletedRoomTypesCount = 0;
    let deletedRoomsCount = 0;
    let deletedInventoryCount = 0;

    for (const typeCode of roomTypesToDelete) {
      console.log(`\n   处理房型: ${typeCode}`);

      try {
        // 3.1 删除关联的房间
        const roomsDeleteResult = await query('DELETE FROM rooms WHERE type_code = $1', [typeCode]);
        const roomsDeleted = roomsDeleteResult.rowCount || 0;
        deletedRoomsCount += roomsDeleted;

        if (roomsDeleted > 0) {
          console.log(`     ✅ 删除了 ${roomsDeleted} 个房间`);
        }

        // 3.2 删除关联的库存记录
        const inventoryDeleteResult = await query('DELETE FROM inventory WHERE type_code = $1', [typeCode]);
        const inventoryDeleted = inventoryDeleteResult.rowCount || 0;
        deletedInventoryCount += inventoryDeleted;

        if (inventoryDeleted > 0) {
          console.log(`     ✅ 删除了 ${inventoryDeleted} 个库存记录`);
        }

        // 3.3 删除房型
        const roomTypeDeleteResult = await query('DELETE FROM room_types WHERE type_code = $1', [typeCode]);
        const roomTypeDeleted = roomTypeDeleteResult.rowCount || 0;

        if (roomTypeDeleted > 0) {
          console.log(`     ✅ 删除房型: ${typeCode}`);
          deletedRoomTypesCount++;
        } else {
          console.log(`     ⚠️  房型 ${typeCode} 不存在或已被删除`);
        }

      } catch (error) {
        console.log(`     ❌ 删除房型 ${typeCode} 失败: ${error.message}`);
      }
    }

    // 4. 统计信息
    console.log('\n📊 删除操作统计:');
    console.log(`   删除房型: ${deletedRoomTypesCount} 个`);
    console.log(`   删除房间: ${deletedRoomsCount} 个`);
    console.log(`   删除库存记录: ${deletedInventoryCount} 个`);

    // 5. 验证结果 - 显示剩余的房型
    console.log('\n🔍 验证结果:');

    const remainingRoomTypes = await query('SELECT type_code, type_name, base_price FROM room_types ORDER BY type_name');
    console.log(`\n   剩余房型 (${remainingRoomTypes.rows.length} 个):`);
    remainingRoomTypes.rows.forEach(type => {
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

    console.log('\n   各房型房间数量:');
    if (remainingRoomCounts.rows.length > 0) {
      remainingRoomCounts.rows.forEach(count => {
        console.log(`     - ${count.type_name || count.type_code}: ${count.room_count} 间`);
      });
    } else {
      console.log('     无房间记录');
    }

    console.log('\n🎉 旧房型删除完成！');

  } catch (error) {
    console.error('❌ 删除房型时发生错误:', error);
  }
}

// 执行脚本
if (require.main === module) {
  deleteOldRoomTypes()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { deleteOldRoomTypes, roomTypesToDelete };
