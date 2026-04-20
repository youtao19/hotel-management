const { douyinConfig } = require('../appSettings/douyin.config');
const douyinTokenService = require('./douyinTokenService');
const db = require('../database/postgreDB/pg');

function createServiceError(message, statusCode = 500, details = {}) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.douyinLogId = details.douyinLogId || null;
    return error;
}

class RoomStaticInfo {
    constructor() {
        this.apiUrl = `${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/physical_room/search/`;
        this.accountId = douyinConfig.accountId;
        this.poiId = douyinConfig.poiId;
    }

    /**
     * 查询抖音当前酒店下的物理房型。
     * @param {string} douyinPoiId 抖音酒店 ID
     * @param {object} options 查询参数
     * @param {string} [options.accountId] 抖音商家账号 ID
     * @returns {Promise<object>} 抖音原始响应和房型 ID 列表
     */
    async getRoomInfoFromDouyin(douyinPoiId, options = {}) {
        const accountId = options.accountId || this.accountId;

        if (!accountId) {
            throw createServiceError('缺少抖音商家 account_id，请配置 DOUYIN_ACCOUNT_ID', 400);
        }

        if (!douyinPoiId) {
            throw createServiceError('缺少抖音酒店 ID，请配置 DOUYIN_POI_ID 或传入 poiId', 400);
        }

        try {
            const token = await douyinTokenService.getToken();
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': token
                },
                body: JSON.stringify({
                    account_id: accountId,
                    poi_ids: [douyinPoiId]
                })
            });

            const result = await response.json();
            const logId = this._getDouyinLogId(result);
            if (logId) {
                console.log(`[Douyin Room] 抖音 logid: ${logId}`);
            }

            if (!response.ok) {
                throw createServiceError(`抖音房型查询 HTTP ${response.status}: ${JSON.stringify(result)}`, 502, {
                    douyinLogId: logId
                });
            }

            this._assertDouyinSuccess(result, logId);

            const rooms = this._extractRooms(result, douyinPoiId);
            const roomIds = rooms
                .map((room) => room.room_id)
                .filter(Boolean);

            return {
                success: true,
                data: result,
                rooms,
                room_ids: roomIds,
                logId
            };
        } catch (error) {
            console.error(`[Douyin Room] 获取房型信息失败: ${error.message}`);
            if (error?.douyinLogId) {
                console.error('[Douyin Room] 抖音 logid:', error.douyinLogId);
            }
            throw error;
        }
    }

    /**
     * 从抖音刷新真实物理房型并落库。
     * 注意：套餐同步依赖本地缓存中的 room_id 和 hotel_id，所以刷新时必须把酒店 ID 一并写入 raw_payload。
     * @param {object} options 刷新参数
     * @param {string} [options.poiId] 抖音酒店 ID
     * @param {string} [options.accountId] 抖音商家账号 ID
     * @returns {Promise<object>} 刷新结果
     */
    async refreshPhysicalRoomsFromDouyin(options = {}) {
        const accountId = options.accountId || this.accountId;
        const poiId = options.poiId || this.poiId;

        const result = await this.getRoomInfoFromDouyin(poiId, { accountId });
        const rooms = result.rooms;

        for (const room of rooms) {
            await this._upsertPhysicalRoom(room, {
                accountId,
                poiId
            });
        }

        return {
            success: true,
            rooms,
            roomIds: result.room_ids,
            savedCount: rooms.length,
            logId: result.logId
        };
    }

    _getDouyinLogId(result) {
        return result?.extra?.logid
            || result?.extra?.log_id
            || result?.base_resp?.extra?.logid
            || result?.base_resp?.extra?.log_id
            || result?.BaseResp?.Extra?.logid
            || null;
    }

    _assertDouyinSuccess(result, logId = null) {
        if (result.extra && Number(result.extra.error_code || 0) !== 0) {
            throw createServiceError(result.extra.sub_description || result.extra.description || '抖音房型查询失败', 502, {
                douyinLogId: logId
            });
        }

        if (!result.data || Number(result.data.error_code || 0) !== 0) {
            throw createServiceError(result.data?.description || '抖音房型查询失败', 502, {
                douyinLogId: logId
            });
        }
    }

    _extractRooms(result, poiId) {
        const roomLists = result.data?.room_lists || {};
        const rooms = roomLists[poiId] || [];

        if (!Array.isArray(rooms)) {
            throw createServiceError('抖音房型查询结果格式异常', 502);
        }

        return rooms;
    }

    async _upsertPhysicalRoom(room, context) {
        const roomId = room.room_id;
        if (!roomId) {
            return;
        }

        const rawPayload = {
            ...room,
            hotel_id: context.poiId,
            poi_id: context.poiId
        };

        const roomName = room.cn_name || room.room_name || room.name || roomId;
        const status = this._resolveRoomStatus(room);

        const nextRatePlanList = Array.isArray(room.rate_plan_list)
            ? JSON.stringify(room.rate_plan_list)
            : null;

        await db.query(
            `
                INSERT INTO douyin_physical_rooms
                    (account_id, room_id, room_name, status, audit_message, rate_plan_list, raw_payload)
                VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '[]'::jsonb), $7)
                ON CONFLICT (room_id)
                DO UPDATE SET
                    account_id = EXCLUDED.account_id,
                    room_name = EXCLUDED.room_name,
                    status = EXCLUDED.status,
                    audit_message = EXCLUDED.audit_message,
                    rate_plan_list = COALESCE($6::jsonb, douyin_physical_rooms.rate_plan_list),
                    raw_payload = EXCLUDED.raw_payload,
                    updated_at = CURRENT_TIMESTAMP
            `,
            [
                context.accountId,
                roomId,
                roomName,
                status,
                room.audit_message || room.audit_msg || null,
                nextRatePlanList,
                JSON.stringify(rawPayload)
            ]
        );
    }

    _resolveRoomStatus(room) {
        if (room.status !== undefined && room.status !== null) {
            return Number(room.status);
        }

        if (room.active === true) {
            return 1;
        }

        if (room.active === false) {
            return 0;
        }

        return null;
    }
}

module.exports = new RoomStaticInfo();
