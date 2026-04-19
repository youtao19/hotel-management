const setup = require('../appSettings/douyin.config');
const douyinTokenService = require('./douyinTokenService'); // 你的 Token 服务
const db = require('../database/postgreDB/pg'); // 假设这是你的 PostgreSQL 连接工具

class RoomStaticInfo {
    constructor() {
        // 房型静态信息同步接口 URL
        this.apiUrl = 'https://open.douyin.com/goodlife/v1/trip/physical_room/search/';
        this.accountId = setup.douyinConfig.accountId;
    }

    async getRoomInfoFromDouyin(douyinPoiIds) {
        try {
            const token = await douyinTokenService.getToken();
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': token
                },
                body: JSON.stringify({
                    account_id: this.accountId,
                    poi_ids: [douyinPoiIds]
                })
            });

            const result = await response.json();

            console.log('the result is', result);

            const roomLists = result.data.room_lists;
            const rooms = roomLists[douyinPoiIds];

            const roomIds = [];
            for (const room of rooms) {
                roomIds.push(room.room_id);
            }

            return { success: true, data: result, room_ids: roomIds };

        } catch (error) {
            console.error(`[Douyin Room] 获取房型信息失败: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new RoomStaticInfo();
