const roomQuery = require('../../modules/douyin/physical-room/roomQuery.service');
const RoomStaticInfo = require('../../modules/douyin/physical-room/physicalRoom.service');

async function runTest() {
  const roomIds = (await RoomStaticInfo.getRoomInfoFromDouyin('7507526304168216616')).room_ids;

  try {
    console.log('🚀 开始测试抖音rate_plan查询...');
    const result = await roomQuery.getRoomInfoFromDouyin(roomIds);
    console.log('✅ rate_plan查询结果:', result.rate_plans);

  } catch (error) {
    console.error('❌ 测试失败，拦截到错误:', error.message);
  } finally {
    process.exit(0);
  }
}

runTest();
