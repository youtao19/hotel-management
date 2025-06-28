const { query } = require('../backend/database/postgreDB/pg');

// 房间号到新房型的映射关系（基于准确的房间配置信息）
const roomToTypeMapping = {
  // 阿苏晓筑
  '101': 'asu_wan_zhu',
  '102': 'asu_wan_zhu',
  '103': 'asu_wan_zhu',
  '105': 'asu_wan_zhu',
  '106': 'asu_wan_zhu',
  '107': 'asu_wan_zhu',
  '108': 'asu_wan_zhu',
  '109': 'asu_wan_zhu',
  '110': 'asu_wan_zhu',
  '111': 'asu_wan_zhu',

  // 行云阁
  '403': 'xing_yun_ge',

  // 有个院子
  '113': 'xing_yun_ge',
  '115': 'xing_yun_ge',
  '117': 'xing_yun_ge',

  // 声声慢投影大床
  '201': 'sheng_sheng_man',
  '203': 'sheng_sheng_man',
  '301': 'sheng_sheng_man',
  '303': 'sheng_sheng_man',

  // 忆江南大床房
  '205': 'yi_jiang_nan',
  '211': 'yi_jiang_nan',
  '305': 'yi_jiang_nan',
  '311': 'yi_jiang_nan',
  '312': 'yi_jiang_nan',

  // 云居云端影音房
  '401': 'yun_ju_ying_yin',
  '402': 'yun_ju_ying_yin',

  // 泊野双床
  '202': 'bo_ye_shuang',
  '206': 'bo_ye_shuang',
  '207': 'bo_ye_shuang',
  '208': 'bo_ye_shuang',
  '302': 'bo_ye_shuang',
  '306': 'bo_ye_shuang',
  '307': 'bo_ye_shuang',
  '308': 'bo_ye_shuang',

  // 暖居家庭房
  '209': 'nuan_ju_jiating',
  '210': 'nuan_ju_jiating',
  '212': 'nuan_ju_jiating',
  '309': 'nuan_ju_jiating',
  '310': 'nuan_ju_jiating',

  // 醉山塘
  '112': 'zui_shan_tang',
  '116': 'zui_shan_tang'
};

// 房型价格映射
const typePriceMapping = {
  'asu_wan_zhu': 288.00,
  'xing_yun_ge': 388.00,
  'sheng_sheng_man': 348.00,
  'yi_jiang_nan': 268.00,
  'yun_ju_ying_yin': 428.00,
  'bo_ye_shuang': 258.00,
  'nuan_ju_jiating': 368.00,
  'zui_shan_tang': 398.00
};

async function updateExistingRooms() {
  try {
    console.log('🔄 开始更新现有房间的房型配置...\n');

    // 1. 检查现有房间状态
    console.log('1. 检查现有房间状态...');
    const existingRooms = await query('SELECT room_number, type_code, price FROM rooms ORDER BY room_number');
    console.log(`   找到 ${existingRooms.rows.length} 个现有房间`);

    // 2. 更新房间房型
    console.log('\n2. 更新房间房型...');
    let updatedCount = 0;
    let skippedCount = 0;

    for (const room of existingRooms.rows) {
      const roomNumber = room.room_number;
      const newTypeCode = roomToTypeMapping[roomNumber];

      if (newTypeCode) {
        const newPrice = typePriceMapping[newTypeCode];

        try {
          // 更新房间的房型和价格
          await query(`
            UPDATE rooms
            SET type_code = $1, price = $2
            WHERE room_number = $3
          `, [newTypeCode, newPrice, roomNumber]);

          console.log(`   ✅ 更新房间 ${roomNumber}: ${room.type_code} -> ${newTypeCode} (¥${newPrice})`);
          updatedCount++;
        } catch (error) {
          console.log(`   ❌ 更新房间 ${roomNumber} 失败: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  房间 ${roomNumber} 未在映射表中找到对应房型，保持原状态 (${room.type_code})`);
        skippedCount++;
      }
    }

    // 3. 统计信息
    console.log('\n📊 更新操作统计:');
    console.log(`   更新房间: ${updatedCount} 间`);
    console.log(`   跳过房间: ${skippedCount} 间`);

    // 4. 验证结果
    console.log('\n🔍 验证更新结果:');

    // 按房型统计房间数量
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

    // 显示所有房间的最新状态
    const allRoomsUpdated = await query(`
      SELECT r.room_number, r.type_code, rt.type_name, r.price
      FROM rooms r
      LEFT JOIN room_types rt ON r.type_code = rt.type_code
      ORDER BY r.room_number::INTEGER
    `);

    console.log('\n   所有房间详情:');
    allRoomsUpdated.rows.forEach(room => {
      console.log(`     房间 ${room.room_number}: ${room.type_name || room.type_code} (¥${room.price})`);
    });

    console.log('\n🎉 房间房型更新完成！');

  } catch (error) {
    console.error('❌ 更新房间房型时发生错误:', error);
  }
}

// 执行脚本
if (require.main === module) {
  updateExistingRooms()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { updateExistingRooms, roomToTypeMapping, typePriceMapping };
