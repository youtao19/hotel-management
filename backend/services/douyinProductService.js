const douyinTokenService = require('./douyinTokenService'); // 你的 Token 服务
const setup = require('../appSettings/douyin.config');
const db = require('../database/postgreDB/pg'); // 假设这是你的 PostgreSQL 连接工具

class DouyinProductService {
    constructor() {
        this.apiUrl = 'https://open.douyin.com/goodlife/v1/trip/hotel/presale/rateplan/save/';
        // 抖音分配给商家的 account_id
        this.accountId = setup.douyinConfig.accountId;
    }

    /**
     * 核心方法：将本地套餐同步到抖音
     * @param {number} localRatePlanId 本地 rate_plans 表的自增 ID
     */
    async syncProductToDouyin(localRatePlanId) {
        try {
            // ==========================================
            // 1. 准备数据：联表查询本地基础信息和已有的抖音映射 ID
            // ==========================================
            /* * SQL 逻辑：
             * SELECT
             * rp.name, rp.breakfast_type, rp.cancel_policy,
             * r.douyin_room_id,
             * h.douyin_poi_id
             * FROM rate_plans rp
             * JOIN rooms r ON rp.room_id = r.id
             * JOIN hotels h ON r.hotel_id = h.id  -- (假设你房间表连了酒店表)
             * WHERE rp.id = 101;
             */
            const localProduct = await this._getLocalProductDetails(localRatePlanId);
            if (!localProduct) {
                throw new Error(`本地套餐 ${localRatePlanId} 不存在或数据不完整`);
            }
            if (!localProduct.douyin_room_id || !localProduct.douyin_poi_id) {
                throw new Error('酒店或物理房型尚未绑定抖音侧的 ID，无法推送套餐！');
            }

            // ==========================================
            // 2. 组装数据：严格按照抖音文档的数据格式
            // ==========================================
            const payload = {
                account_id: this.accountId,
                rate_plan: {
                    hotel_id: localProduct.douyin_poi_id,
                    rooms: [
                        {
                            room_id: localProduct.douyin_room_id,
                            rate_plans: [
                                {
                                    // 核心：把你们自己的 ID 传过去
                                    out_rate_plan_id: String(localRatePlanId),
                                    rate_plan_name: localProduct.name,
                                    sales_type: 1, // 假设 1 代表普通售卖
                                    // 根据本地字典转换：比如 0 是无早，抖音文档里对应的是 0 或其他枚举
                                    breakfast: localProduct.breakfast_type,
                                    // ... 其他业务必填字段 (退款政策、预定时间等)
                                }
                            ]
                        }
                    ]
                }
            };

            // ==========================================
            // 3. 发送网络请求：极其丝滑地获取 Token 并发请求
            // ==========================================
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

            // ==========================================
            // 4. 处理结果与落库映射
            // ==========================================
            if (result.data && result.data.error_code === 0) {
                // 抖音成功创建/更新后，返回了它的商品 ID
                const douyinRatePlanId = result.data.rate_plan_map[0].rate_plan_id;

                // 执行超级映射表的插入或更新 (UPSERT)
                await this._saveChannelMapping(localRatePlanId, douyinRatePlanId);

                console.log(`[Douyin Sync] 同步成功！抖音商品ID: ${douyinRatePlanId}`);
                return { success: true, douyinId: douyinRatePlanId };
            } else {
                console.error('[Douyin Sync] 抖音返回业务报错:', result);
                throw new Error(result.data?.description || '抖音接口未知错误');
            }

        } catch (error) {
            console.error('[Douyin Sync] 同步执行异常:', error.message);
            throw error; // 继续向上抛给 Controller
        }
    }

    /**
     * 内部辅助：模拟查询数据库获取本地数据
     */
    async _getLocalProductDetails(id) {
        // 这里用假数据代替你真实的 DB 查询
        return {
            name: "豪华大床房-双早特惠",
            breakfast_type: 2,
            douyin_room_id: "ROOM_XYZ999", // 之前人工填写的抖音物理房型 ID
            douyin_poi_id: "POI_123456"    // 之前人工填写的抖音门店 ID
        };
    }

    /**
     * 内部辅助：更新渠道映射表 (PostgreSQL 特有的 UPSERT 语法)
     */
    async _saveChannelMapping(localId, douyinId) {
        // 这是一段典型的 PostgreSQL 语法：如果发现这条记录已经存在，就更新它；如果不存在，就插入它。
        const sql = `
            INSERT INTO ota_channel_mappings
            (local_target_type, local_target_id, channel_code, channel_item_id, sync_status)
            VALUES ('RATE_PLAN', $1, 'DOUYIN', $2, 1)
            ON CONFLICT (local_target_type, local_target_id, channel_code)
            DO UPDATE SET
                channel_item_id = EXCLUDED.channel_item_id,
                sync_status = EXCLUDED.sync_status,
                updated_at = CURRENT_TIMESTAMP;
        `;

        // 执行真实的 DB 操作
        // await db.query(sql, [localId, douyinId]);
        console.log(`[DB Mock] 记录映射关系: 本地套餐 ${localId} -> 抖音 ${douyinId}`);
    }
}

module.exports = new DouyinProductService();
