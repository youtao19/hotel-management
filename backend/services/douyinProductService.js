const douyinTokenService = require('./douyinTokenService');
const { douyinConfig } = require('../appSettings/douyin.config');
const db = require('../database/postgreDB/pg');

function createServiceError(message, statusCode = 500, details = {}) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.douyinLogId = details.douyinLogId || null;
    return error;
}

class DouyinProductService {
    constructor() {
        this.apiUrl = `${douyinConfig.openApiBaseUrl}/goodlife/v1/trip/hotel/presale/rateplan/save/`;
        this.accountId = douyinConfig.accountId;
        this.poiId = douyinConfig.poiId;
    }

    /**
     * 将本地套餐同步到抖音预售券预定商品。
     * @param {number} localRatePlanId 本地 rate_plans 表的自增 ID
     * @param {object} options 同步时允许覆盖的抖音账号和酒店 ID
     * @param {string} [options.accountId] 抖音商家账号 ID
     * @param {string} [options.poiId] 抖音酒店 ID
     * @returns {Promise<object>} 同步结果
     */
    async syncProductToDouyin(localRatePlanId, options = {}) {
        try {
            const localProduct = await this._getLocalProductDetails(localRatePlanId);
            if (!localProduct) {
                throw createServiceError(`本地套餐 ${localRatePlanId} 不存在`, 404);
            }

            if (!localProduct.douyin_room_id) {
                throw createServiceError('套餐所属房型尚未绑定抖音物理房型，无法同步', 400);
            }

            const accountId = this._resolveAccountId(localProduct, options);
            const hotelId = this._resolveHotelId(localProduct, options);

            if (!accountId) {
                throw createServiceError('缺少抖音商家 account_id，请传 accountId 或配置 DOUYIN_ACCOUNT_ID', 400);
            }

            if (!hotelId) {
                throw createServiceError('缺少抖音酒店 ID，请传 poiId 或配置 DOUYIN_POI_ID', 400);
            }

            this._validatePhysicalRoomCache(localProduct, {
                accountId,
                hotelId
            });

            const payload = this._buildRatePlanPayload(localProduct, {
                accountId,
                hotelId
            });

            const token = await douyinTokenService.getToken();

            console.log(`[Douyin Sync] 开始同步本地套餐: ${localRatePlanId}`);
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': token
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const logId = this._getDouyinLogId(result);
            if (logId) {
                console.log(`[Douyin Sync] 抖音 logid: ${logId}`);
            }

            if (!response.ok) {
                throw createServiceError(`抖音接口 HTTP ${response.status}: ${JSON.stringify(result)}`, 502, {
                    douyinLogId: logId
                });
            }

            this._assertDouyinSuccess(result, logId);
            const ratePlanMap = this._getSyncedRatePlanMap(result, localRatePlanId);
            const douyinRatePlanId = ratePlanMap.rate_plan_id;

            await this._saveChannelMapping(localProduct, {
                accountId,
                hotelId,
                douyinRatePlanId,
                logId
            });
            await this._savePhysicalRoomRatePlan(localProduct, {
                douyinRatePlanId,
                hotelId
            });

            console.log(`[Douyin Sync] 同步成功！抖音商品ID: ${douyinRatePlanId}`);
            return {
                success: true,
                douyinId: douyinRatePlanId,
                outRatePlanId: String(localRatePlanId),
                roomId: localProduct.douyin_room_id,
                hotelId,
                logId
            };

        } catch (error) {
            const statusCode = Number(error?.statusCode || error?.status || 500);
            const log = statusCode >= 500 ? console.error : console.warn;
            log('[Douyin Sync] 同步执行异常:', error.message);
            if (error?.douyinLogId) {
                log('[Douyin Sync] 抖音 logid:', error.douyinLogId);
            }
            throw error;
        }
    }

    async _getLocalProductDetails(id) {
        const result = await db.query(
            `
                SELECT
                    rp.*,
                    rt.type_name AS room_type_name,
                    drm.douyin_room_id,
                    drm.douyin_room_name,
                    dpr.room_id AS douyin_cached_room_id,
                    dpr.account_id AS douyin_account_id,
                    dpr.raw_payload AS douyin_room_payload,
                    dpr.rate_plan_list AS douyin_rate_plan_list,
                    ocm.channel_item_id AS douyin_rate_plan_id
                FROM rate_plans rp
                LEFT JOIN room_types rt ON rp.room_type_code = rt.type_code
                LEFT JOIN douyin_room_type_mapping drm ON drm.local_room_type = rp.room_type_code
                LEFT JOIN douyin_physical_rooms dpr ON dpr.room_id = drm.douyin_room_id
                LEFT JOIN ota_channel_mappings ocm
                    ON ocm.local_target_type = 'RATE_PLAN'
                    AND ocm.local_target_id = rp.id
                    AND ocm.channel_code = 'DOUYIN'
                WHERE rp.id = $1
            `,
            [id]
        );

        return result.rows[0] || null;
    }

    _resolveAccountId(localProduct, options) {
        return options.accountId || localProduct.douyin_account_id || this.accountId || '';
    }

    _resolveHotelId(localProduct, options) {
        const rawPayload = localProduct.douyin_room_payload || {};
        return options.poiId
            || rawPayload.hotel_id
            || rawPayload.hotelId
            || rawPayload.poi_id
            || rawPayload.poiId
            || rawPayload.hotel?.hotel_id
            || this.poiId
            || '';
    }

    _validatePhysicalRoomCache(localProduct, context) {
        if (!localProduct.douyin_cached_room_id) {
            throw createServiceError('抖音物理房型缓存缺失，请先刷新抖音房型后再同步套餐', 400);
        }

        if (localProduct.douyin_account_id
            && String(localProduct.douyin_account_id) !== String(context.accountId)) {
            throw createServiceError('抖音物理房型所属账号与当前同步账号不一致，请刷新并重新匹配房型', 400);
        }

        const cachedHotelId = this._getRoomHotelId(localProduct.douyin_room_payload || {});
        if (!cachedHotelId) {
            throw createServiceError('抖音物理房型缓存缺少酒店 ID，请先刷新抖音房型后再同步套餐', 400);
        }

        if (String(cachedHotelId) !== String(context.hotelId)) {
            throw createServiceError('抖音物理房型所属酒店与当前同步酒店不一致，请刷新并重新匹配房型', 400);
        }
    }

    _getRoomHotelId(rawPayload) {
        return rawPayload.hotel_id
            || rawPayload.hotelId
            || rawPayload.poi_id
            || rawPayload.poiId
            || rawPayload.hotel?.hotel_id
            || '';
    }

    _buildRatePlanPayload(localProduct, context) {
        const salesType = Number(localProduct.sales_type || 1);
        if (salesType === 3) {
            throw createServiceError('抖音预售券预定商品暂不支持凌晨房套餐同步', 400);
        }

        const ratePlan = {
            currency: localProduct.currency || 'CNY',
            active: Number(localProduct.status) === 1,
            sales_type: salesType,
            rate_plan_name: localProduct.name,
            out_rate_plan_id: String(localProduct.id)
        };

        if (localProduct.douyin_rate_plan_id) {
            ratePlan.rate_plan_id = localProduct.douyin_rate_plan_id;
        }

        if (salesType === 2) {
            ratePlan.hourly_room_detail = {
                earliest_check_in: localProduct.hourly_earliest_check_in,
                latest_check_out: localProduct.hourly_latest_check_out,
                usage_duration: Number(localProduct.hourly_usage_duration)
            };
        }

        return {
            account_id: context.accountId,
            rate_plan: {
                hotel_id: context.hotelId,
                rooms: [
                    {
                        room_id: localProduct.douyin_room_id,
                        rate_plans: [ratePlan]
                    }
                ]
            }
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
            throw createServiceError(result.extra.sub_description || result.extra.description || '抖音接口调用失败', 502, {
                douyinLogId: logId
            });
        }

        if (!result.data || Number(result.data.error_code || 0) !== 0) {
            throw createServiceError(result.data?.description || '抖音商品同步失败', 502, {
                douyinLogId: logId
            });
        }
    }

    _getSyncedRatePlanMap(result, localRatePlanId) {
        const outRatePlanId = String(localRatePlanId);
        const ratePlanMap = Array.isArray(result.data?.rate_plan_map) ? result.data.rate_plan_map : [];
        const matched = ratePlanMap.find((item) => String(item.out_rate_plan_id) === outRatePlanId) || ratePlanMap[0];

        if (!matched || !matched.rate_plan_id) {
            throw createServiceError('抖音同步成功但未返回 rate_plan_id', 502);
        }

        return matched;
    }

    async _saveChannelMapping(localProduct, syncResult) {
        const channelConfig = {
            out_rate_plan_id: String(localProduct.id),
            room_id: localProduct.douyin_room_id,
            hotel_id: syncResult.hotelId,
            account_id: syncResult.accountId,
            log_id: syncResult.logId
        };

        const sql = `
            INSERT INTO ota_channel_mappings
            (local_target_type, local_target_id, channel_code, channel_item_id, channel_config, sync_status)
            VALUES ('RATE_PLAN', $1, 'DOUYIN', $2, $3, 1)
            ON CONFLICT (local_target_type, local_target_id, channel_code)
            DO UPDATE SET
                channel_item_id = EXCLUDED.channel_item_id,
                channel_config = EXCLUDED.channel_config,
                sync_status = EXCLUDED.sync_status,
                updated_at = CURRENT_TIMESTAMP;
        `;

        await db.query(sql, [localProduct.id, syncResult.douyinRatePlanId, JSON.stringify(channelConfig)]);
    }

    async _savePhysicalRoomRatePlan(localProduct, syncResult) {
        const currentList = Array.isArray(localProduct.douyin_rate_plan_list)
            ? localProduct.douyin_rate_plan_list
            : [];
        const outRatePlanId = String(localProduct.id);
        const nextItem = {
            rate_plan_id: syncResult.douyinRatePlanId,
            out_rate_plan_id: outRatePlanId,
            rate_plan_name: localProduct.name,
            active: Number(localProduct.status) === 1,
            sales_type: Number(localProduct.sales_type || 1),
            currency: localProduct.currency || 'CNY',
            hotel_id: syncResult.hotelId
        };
        const nextList = currentList.filter((item) => {
            return String(item.out_rate_plan_id) !== outRatePlanId
                && String(item.rate_plan_id) !== String(syncResult.douyinRatePlanId);
        });
        nextList.push(nextItem);

        await db.query(
            `
                UPDATE douyin_physical_rooms
                SET rate_plan_list = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE room_id = $2
            `,
            [JSON.stringify(nextList), localProduct.douyin_room_id]
        );
    }
}

module.exports = new DouyinProductService();
