const douyinTokenService = require('./douyinTokenService');
const setup = require('../../appSettings/setup');
const db = require('../database/pg'); // 你的 PostgreSQL 封装

class DouyinRoomService {
    constructor() {
        // 房型静态信息同步接口 URL
        this.apiUrl = 'https://open.douyin.com/goodlife/v1/trip/hotel/presale/room_info/save/';
        this.accountId = setup.douyin.accountId || process.env.DOUYIN_ACCOUNT_ID;
    }

    /**
     * 将本地物理房型同步到抖音
     * @param {number} localRoomId 本地 rooms 表的 ID
     */
    async syncRoomToDouyin(localRoomId) {
        try {
            // 1. 查询本地数据库的物理房型信息
            /* * SQL 逻辑：
             * SELECT r.*, h.douyin_poi_id
             * FROM rooms r JOIN hotels h ON r.hotel_id = h.id
             * WHERE r.id = $1;
             */
            const localRoom = await this._getLocalRoomDetails(localRoomId);
            if (!localRoom || !localRoom.douyin_poi_id) {
                throw new Error(`找不到房型 ${localRoomId} 或其关联的抖音门店 ID`);
            }

            // 2. 组装数据：严格对照你发的第一个文档 (room-static-info)
            const payload = {
                account_id: this.accountId,
                room: {
                    hotel_id: localRoom.douyin_poi_id, // 抖音的门店/酒店 ID
                    out_room_id: String(localRoomId),  // 极度重要：你们本地的物理房型 ID
                    name: localRoom.name,              // 例如 "高级大床房"

                    // 下面这些必填项，你需要根据你的数据库实际字段来转换
                    // 抖音文档有严格的字典映射，比如大床是 1，双床是 2 等
                    room_bed_type: localRoom.bed_type || 1,
                    // 面积 (通常填范围，如 30-40)
                    room_area: localRoom.area || "30",
                    // 宽带配置 (1:无, 2:有线, 3:无线, 4:全部)
                    room_broadband: 3,
                    // 窗户配置 (1:有窗, 2:无窗, 3:部分有窗)
                    window: 1,
                    // 设施列表 (文档要求传字典 ID 数组，比如 1代表电视，2代表空调)
                    facilities: [1, 2, 3],
                    // 最多入住人数
                    capacity: 2
                }
            };

            // 3. 请求抖音 API
            const token = await douyinTokenService.getToken();
            console.log(`[Douyin Room] 开始同步物理房型: ${localRoomId}`);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': token
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            // 4. 处理结果并落库
            if (result.data && result.data.error_code === 0) {
                // 抖音成功创建房型，返回了真实的物理 room_id
                const douyinRoomId = result.data.room.room_id;

                console.log(`[Douyin Room] 房型同步成功！抖音房型ID: ${douyinRoomId}`);

                // 5. 将映射关系存入我们昨天建的超级映射表 ota_channel_mappings
                // 注意这里的 target_type 是 'ROOM'，不是 'RATE_PLAN' 了！
                await this._saveChannelMapping(localRoomId, douyinRoomId);

                return { success: true, douyinRoomId: douyinRoomId };
            } else {
                console.error('[Douyin Room] 房型同步失败详情:', result);
                throw new Error(result.data?.description || '房型同步业务错误');
            }

        } catch (error) {
            console.error('[Douyin Room] 房型同步抛出异常:', error.message);
            throw error;
        }
    }

    /**
     * 内部辅助：Mock 数据库查询
     */
    async _getLocalRoomDetails(id) {
        return {
            id: id,
            name: "高级大床房",
            bed_type: 1,
            area: "35",
            douyin_poi_id: "POI_TEST_12345" // 你填入的测试 POI ID
        };
    }

    /**
     * 内部辅助：保存映射关系到 ota_channel_mappings 表
     */
    async _saveChannelMapping(localId, douyinId) {
        const sql = `
            INSERT INTO ota_channel_mappings
            (local_target_type, local_target_id, channel_code, channel_item_id)
            VALUES ('ROOM', $1, 'DOUYIN', $2)
            ON CONFLICT (local_target_type, local_target_id, channel_code)
            DO UPDATE SET
                channel_item_id = EXCLUDED.channel_item_id,
                updated_at = CURRENT_TIMESTAMP;
        `;
        // await db.query(sql, [localId, douyinId]);
        console.log(`[DB Mock] 记录映射: 本地物理房型 ${localId} -> 抖音房型 ${douyinId}`);
    }
}

module.exports = new DouyinRoomService();
