const { query } = require('../backend/database/postgreDB/pg');
const { roomToTypeMapping, typePriceMapping } = require('./updateExistingRooms');

/**
 * 添加缺失的房间
 * 此脚本会检查房间映射表中定义的房间，并将缺失的房间添加到数据库
 */
async function addMissingRooms() {
  try {
    console.log('🏨 开始添加缺失房间...\n');

    // 1. 获取当前已存在的房间
    console.log('1. 检查当前存在的房间...');
    const existingRooms = await query('SELECT room_number FROM rooms');
    const existingRoomNumbers = existingRooms.rows.map(row => row.room_number);
    console.log(`   系统中已存在 ${existingRoomNumbers.length} 个房间`);

    // 2. 确定需要添加的房间
    console.log('\n2. 确定需要添加的房间...');
    const allRoomNumbers = Object.keys(roomToTypeMapping);
    const roomsToAdd = allRoomNumbers.filter(room => !existingRoomNumbers.includes(room));

    if (roomsToAdd.length === 0) {
      console.log('   ✅ 所有房间已存在，无需添加新房间');
      return;
    }

    console.log(`   找到 ${roomsToAdd.length} 个需要添加的房间:`);
    roomsToAdd.forEach(roomNumber => {
      const typeCode = roomToTypeMapping[roomNumber];
      console.log(`   - 房间 ${roomNumber}: ${typeCode}`);
    });

    // 3. 添加缺失房间
    console.log('\n3. 开始添加房间...');
    let addedCount = 0;
    let errorCount = 0;

    for (const roomNumber of roomsToAdd) {
      const typeCode = roomToTypeMapping[roomNumber];
      const price = typePriceMapping[typeCode];

      try {
        // 获取当前最大的room_id值
        const maxIdResult = await query(`SELECT MAX(room_id) as max_id FROM rooms`);
        const maxId = maxIdResult.rows[0].max_id || 500;  // 如果没有记录，从500开始
        const newId = maxId + 1;

        await query(
          `INSERT INTO rooms (room_id, room_number, type_code, price, status)
           VALUES ($1, $2, $3, $4, 'available')`,
          [newId, roomNumber, typeCode, price]
        );

        console.log(`   ✅ 成功添加房间 ${roomNumber}: ${typeCode} (¥${price})`);
        addedCount++;
      } catch (error) {
        console.log(`   ❌ 添加房间 ${roomNumber} 失败: ${error.message}`);
        errorCount++;
      }
    }

    // 4. 统计结果
    console.log('\n📊 添加操作统计:');
    console.log(`   成功添加: ${addedCount} 间`);
    console.log(`   添加失败: ${errorCount} 间`);

    // 5. 验证结果
    console.log('\n🔍 验证添加结果:');
    const roomCounts = await query(`
      SELECT r.type_code, rt.type_name, COUNT(*) as room_count
      FROM rooms r
      LEFT JOIN room_types rt ON r.type_code = rt.type_code
      GROUP BY r.type_code, rt.type_name
      ORDER BY rt.type_name
    `);

    console.log('\n   各房型房间统计:');
    roomCounts.rows.forEach(count => {
      console.log(`     - ${count.type_name || count.type_code}: ${count.room_count} 间`);
    });

    console.log('\n🎉 缺失房间添加完成！');
  } catch (error) {
    console.error('❌ 添加房间时发生错误:', error);
  }
}

// 执行脚本
if (require.main === module) {
  addMissingRooms()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { addMissingRooms };
