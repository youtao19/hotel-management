const setup = require('../appSettings/douyin.config');
const douyinTokenService = require('./douyinTokenService');
const db = require('../database/postgreDB/pg'); // 假设这是你的 PostgreSQL 连接工具


/**
 * 用于查询 rate_plan_id,rate_plan_name
 */
class RoomQueryService {
    constructor() {
        this.apiUrl = 'https://open.douyin.com/goodlife/v1/trip/physical_room/query/';
        this.accountId = setup.douyinConfig.accountId;
    }

    async getRoomInfoFromDouyin(roomIds) {
        try {
            const token = await douyinTokenService.getToken();
            console.log(`[Douyin Room] 获取房型信息，门店 ID: ${roomIds.join(', ')}`);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': token
                },
                body: JSON.stringify({
                    account_id: this.accountId,
                    room_ids: roomIds,
                    need_rate_plan: true
                })
            });

            const data = await response.json();

if (data.extra?.error_code !== 0) {
  throw new Error(data.extra?.sub_description || data.extra?.description || '抖音接口请求失败');
}

if (data.data?.error_code !== 0) {
  throw new Error(data.data?.description || '抖音房型查询失败');
}

const roomList = data.data?.room_list || [];
const ratePlans = [];

for (const room of roomList) {
  for (const ratePlan of room.rate_plan_list || []) {
    ratePlans.push({
      room_id: room.room_id,
      room_name: room.cn_name,
      rate_plan_id: ratePlan.rate_plan_id,
      rate_plan_name: ratePlan.rate_plan_name,
      rate_plan_type: ratePlan.rate_plan_type,
      status: ratePlan.status
    });
  }
}

return { success: true, data, rate_plans: ratePlans };


        } catch (error) {
            console.error(`[Douyin Room] 获取房型信息失败: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new RoomQueryService();
