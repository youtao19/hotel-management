const roomStaticInfo = require('../../modules/douyin/physical-room/physicalRoom.service');

async function runTest() {
  const poiId = '7507526304168216616';

  console.log('🚀 开始测试抖音房型静态信息同步链路...');

  try {
    const result = await roomStaticInfo.getRoomInfoFromDouyin(poiId);
    const response = result.data;

    if (response.extra?.error_code !== 0) {
      throw new Error(response.extra?.sub_description || response.extra?.description || '抖音接口请求失败');
    }

    if (response.data?.error_code !== 0) {
      throw new Error(response.data?.description || '抖音房型查询失败');
    }

    const roomLists = response.data?.room_lists || {};
    const rooms = roomLists[poiId] || [];

    console.log('✅ 房型数量:', rooms.length);

    const room_ids = []

    for (const room of rooms) {

      room_ids.push(room.room_id);


      // console.log({
      //   room_id: room.room_id,
      //   cn_name: room.cn_name,
      //   status: room.status,
      //   category_id: room.category_id,
      //   max_occupancy: room.max_occupancy,
      //   room_num: room.room_num
      // });
    }
      console.log('房型 ID:', room_ids);

  } catch (error) {
    console.error('❌ 测试失败，拦截到错误:', error.message);
  } finally {
    process.exit(0);
  }
}

runTest();
