const { query } = require('../backend/database/postgreDB/pg');

// 新房型数据配置
const newRoomTypes = [
  {
    type_code: 'asu_wan_zhu',
    type_name: '阿苏晚筑',
    base_price: 288.00,
    description: '舒适的日式风格房间，温馨宁静'
  },
  {
    type_code: 'xing_yun_ge',
    type_name: '行云阁有个院子',
    base_price: 388.00,
    description: '带有私人院子的特色房型，闹中取静'
  },
  {
    type_code: 'sheng_sheng_man',
    type_name: '声声慢投影大床',
    base_price: 348.00,
    description: '配备投影设备的大床房，适合观影休闲'
  },
  {
    type_code: 'yi_jiang_nan',
    type_name: '忆江南大床房',
    base_price: 268.00,
    description: '江南风格装修的大床房，典雅舒适'
  },
  {
    type_code: 'yun_ju_ying_yin',
    type_name: '云居云端影音房',
    base_price: 428.00,
    description: '顶级影音设备配置，享受云端视听体验'
  },
  {
    type_code: 'bo_ye_shuang',
    type_name: '泊野双床',
    base_price: 258.00,
    description: '双床配置，适合朋友或同事入住'
  },
  {
    type_code: 'nuan_ju_jiating',
    type_name: '暖居家庭房',
    base_price: 368.00,
    description: '温馨家庭房，适合全家出行'
  },
  {
    type_code: 'zui_shan_tang',
    type_name: '醉山塘',
    base_price: 398.00,
    description: '山塘街风格装修，体验古典江南韵味'
  }
];

// 新房间数据配置 (根据图片中的房型和房间号对应关系)
const newRoomsConfig = [
  // 阿苏晚筑
  { numbers: ['101', '102', '103', '105', '106', '107', '108', '109', '110', '111'], type_code: 'asu_wan_zhu', base_price: 288.00 },

  // 行云阁有个院子
  { numbers: ['403', '113', '115', '117'], type_code: 'xing_yun_ge', base_price: 388.00 },

  // 声声慢投影大床
  { numbers: ['201', '203', '301', '303', '205', '211', '305', '311', '312'], type_code: 'sheng_sheng_man', base_price: 348.00 },

  // 忆江南大床房 (这个房型似乎和泊野双床有重叠，我将分开处理)
  { numbers: ['202', '206', '207', '208', '302', '306', '307', '308'], type_code: 'yi_jiang_nan', base_price: 268.00 },

  // 云居云端影音房
  { numbers: ['401', '402'], type_code: 'yun_ju_ying_yin', base_price: 428.00 },

  // 泊野双床 (部分房间与忆江南重叠，这里取不重叠的)
  { numbers: ['209', '210'], type_code: 'bo_ye_shuang', base_price: 258.00 },

  // 暖居家庭房
  { numbers: ['212', '309', '310'], type_code: 'nuan_ju_jiating', base_price: 368.00 },

  // 醉山塘
  { numbers: ['112', '116'], type_code: 'zui_shan_tang', base_price: 398.00 }
];

async function addNewRoomTypes() {
  try {
    console.log('🏨 开始添加新房型和房间配置...\n');

    // 1. 添加新房型
    console.log('1. 添加新房型...');
    for (const roomType of newRoomTypes) {
      try {
        await query(`
          INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (type_code) DO UPDATE SET
            type_name = EXCLUDED.type_name,
            base_price = EXCLUDED.base_price,
            description = EXCLUDED.description
        `, [roomType.type_code, roomType.type_name, roomType.base_price, roomType.description, false]);

        console.log(`   ✅ 添加房型: ${roomType.type_name} (${roomType.type_code})`);
      } catch (error) {
        console.log(`   ❌ 添加房型失败: ${roomType.type_name} - ${error.message}`);
      }
    }

    // 2. 获取当前最大的room_id
    console.log('\n2. 获取当前最大房间ID...');
    const maxIdResult = await query('SELECT COALESCE(MAX(room_id), 0) as max_id FROM rooms');
    let currentMaxId = maxIdResult.rows[0].max_id;
    console.log(`   当前最大房间ID: ${currentMaxId}`);

    // 3. 添加新房间
    console.log('\n3. 添加新房间...');
    let addedCount = 0;
    let skippedCount = 0;

    for (const config of newRoomsConfig) {
      console.log(`\n   处理房型: ${config.type_code}`);

      for (const roomNumber of config.numbers) {
        try {
          // 检查房间是否已存在
          const existingRoom = await query('SELECT room_number FROM rooms WHERE room_number = $1', [roomNumber]);

          if (existingRoom.rows.length > 0) {
            console.log(`     ⚠️  房间 ${roomNumber} 已存在，跳过`);
            skippedCount++;
            continue;
          }

          // 添加新房间
          currentMaxId++;
          await query(`
            INSERT INTO rooms (room_id, room_number, type_code, status, price, is_closed)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [currentMaxId, roomNumber, config.type_code, 'available', config.base_price, false]);

          console.log(`     ✅ 添加房间: ${roomNumber} (${config.type_code})`);
          addedCount++;
        } catch (error) {
          console.log(`     ❌ 添加房间失败: ${roomNumber} - ${error.message}`);
        }
      }
    }

    // 4. 统计信息
    console.log('\n📊 操作完成统计:');
    console.log(`   新增房间: ${addedCount} 间`);
    console.log(`   跳过房间: ${skippedCount} 间`);
    console.log(`   新增房型: ${newRoomTypes.length} 种`);

    // 5. 验证结果
    console.log('\n🔍 验证结果:');

    // 查询所有房型
    const allRoomTypes = await query('SELECT type_code, type_name, base_price FROM room_types ORDER BY type_name');
    console.log('\n   当前所有房型:');
    allRoomTypes.rows.forEach(type => {
      console.log(`     - ${type.type_name} (${type.type_code}): ¥${type.base_price}`);
    });

    // 统计各房型的房间数量
    const roomCounts = await query(`
      SELECT r.type_code, rt.type_name, COUNT(*) as room_count
      FROM rooms r
      LEFT JOIN room_types rt ON r.type_code = rt.type_code
      GROUP BY r.type_code, rt.type_name
      ORDER BY rt.type_name
    `);

    console.log('\n   各房型房间数量:');
    roomCounts.rows.forEach(count => {
      console.log(`     - ${count.type_name || count.type_code}: ${count.room_count} 间`);
    });

    console.log('\n🎉 新房型和房间配置添加完成！');

  } catch (error) {
    console.error('❌ 添加新房型时发生错误:', error);
  }
}

// 执行脚本
if (require.main === module) {
  addNewRoomTypes()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { addNewRoomTypes, newRoomTypes, newRoomsConfig };
