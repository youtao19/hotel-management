const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

const {
    getDailyRevenue,
    getWeeklyRevenue,
    getMonthlyRevenue,
    getRoomTypeRevenue,
    getRevenueBillDetails,
    getQuickStatsSummary
} = require('../modules/revenueModule');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isDateString = (value) => DATE_REGEX.test(String(value || ''));

// 复用：多个统计接口都要求 startDate/endDate 且格式为 YYYY-MM-DD
// 注意：这里保持原有错误 message/error 字段不变，避免前端依赖受影响。
const requireDateRangeQuery = (req, res) => {
    const { startDate, endDate, roomType } = req.query;

    if (!startDate || !endDate) {
        res.status(400).json({
            message: '请提供开始日期和结束日期',
            error: 'startDate and endDate are required'
        });
        return null;
    }

    if (!isDateString(startDate) || !isDateString(endDate)) {
        res.status(400).json({
            message: '日期格式错误，请使用YYYY-MM-DD格式',
            error: 'Invalid date format'
        });
        return null;
    }

    return {
        startDate: String(startDate),
        endDate: String(endDate),
        roomType: roomType || undefined
    };
};



/**
 * 获取收入聚合序列（按日/周/月）
 * GET /api/revenue/series?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&bucket=daily|weekly|monthly&roomType=xxx
 * 中文注释：
 * - 该接口返回“按时间聚合后的序列数据”（不是单值汇总），更贴合 series 的语义
 * - bucket 决定聚合粒度（daily/weekly/monthly）
 */
router.get('/series', async (req, res) => {
    try {
        const parsed = requireDateRangeQuery(req, res);
        if (!parsed) return;
        const { startDate, endDate, roomType } = parsed;
        const bucket = String(req.query.bucket || '').trim();

        if (!['daily', 'weekly', 'monthly'].includes(bucket)) {
            return res.status(400).json({
                message: 'bucket 参数错误，请使用 daily/weekly/monthly',
                error: 'Invalid bucket'
            });
        }

        let data = [];
        if (bucket === 'daily') data = await getDailyRevenue(startDate, endDate, roomType);
        else if (bucket === 'weekly') data = await getWeeklyRevenue(startDate, endDate, roomType);
        else data = await getMonthlyRevenue(startDate, endDate, roomType);

        res.json({
            message: '获取收入聚合序列成功',
            data,
            period: {
                startDate,
                endDate,
                bucket,
                roomType: roomType || null
            }
        });
    } catch (error) {
        console.error('获取收入聚合序列失败:', error);
        res.status(500).json({
            message: '获取收入聚合序列失败',
            error: error.message
        });
    }
});

/**
 * 获取房型收入统计
 * GET /api/revenue/room-type?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getRoomTypeRevenue(startDate, endDate)`
 * - `frontend/src/pages/Revenue/composables/useRevenueData.js`：`fetchMainStats()`（RoomTypeAnalysis 房型分析）
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/RoomTypeAnalysis.vue`：左侧「房型营收贡献」列表（type_name / total_revenue / order_count）
 */
router.get('/room-type', async (req, res) => {
    console.log('🏨 收到房型收入统计请求');
    console.log('请求参数:', req.query);
    try {
        const parsed = requireDateRangeQuery(req, res);
        if (!parsed) {
            console.log('❌ 参数验证失败:', req.query);
            return;
        }
        const { startDate, endDate } = parsed;

        const roomTypeRevenue = await getRoomTypeRevenue(startDate, endDate);

        res.json({
            message: '获取房型收入统计成功',
            data: roomTypeRevenue,
            period: {
                startDate,
                endDate,
                type: 'room-type'
            }
        });
    } catch (error) {
        console.error('获取房型收入统计失败:', error);
        res.status(500).json({
            message: '获取房型收入统计失败',
            error: error.message
        });
    }
});

/**
 * 获取快速统计数据（今日、本周、本月）
 * GET /api/revenue/quick-stats
 * 用于收入统计页面的今日收入等卡片
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getQuickStats(baseDate)`
 * - `frontend/src/pages/Revenue/composables/useRevenueData.js`：`initBaseData()` / `fetchMainStats()`
 * - `frontend/src/pages/Revenue/components/QuickStatsCards.vue`：展示 quickStats 与 selectedRangeStats
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/QuickStatsCards.vue`：第 2/3 张卡片「本周收入」「本月收入」（quickStats.thisWeek / quickStats.thisMonth）
 * - `frontend/src/pages/Revenue/components/QuickStatsCards.vue`：selectedTitle 使用 `quickStats.today.date` 判断「今日收入」
 */
router.get('/quick-stats', async (req, res) => {
    console.log('🚀 收到快速统计请求');
    try {
        const { baseDate, startDate, endDate } = req.query;

        // 中文注释：
        // - baseDate：用于测试/对账（例如使用交接班测试 SQL 数据时，可指定某一天作为“今日”）。
        // - startDate/endDate：前端当前所选日期范围；当且仅当“单日”（startDate===endDate）时，首卡展示所选日期收入。
        // - 本周/本月卡片：始终以数据库 current_date 为“今天”（不跟随所选单日），保证口径为“本周/本月（截至今天）”。
        // - 禁止对业务 DATE 字段使用 new Date(dateStr) 或 toISOString()。
        const hasRange = startDate && endDate;
        const normalizedStart = startDate ? String(startDate) : null;
        const normalizedEnd = endDate ? String(endDate) : null;

        if (hasRange) {
            if (!isDateString(normalizedStart) || !isDateString(normalizedEnd)) {
                return res.status(400).json({
                    message: '日期格式错误，请使用YYYY-MM-DD格式',
                    error: 'Invalid date format'
                });
            }
        }

        let selectedToday = null;
        if (baseDate) {
            if (!isDateString(baseDate)) {
                return res.status(400).json({
                    message: '日期格式错误，请使用YYYY-MM-DD格式',
                    error: 'Invalid baseDate format'
                });
            }
            selectedToday = String(baseDate);
        } else if (hasRange && normalizedStart === normalizedEnd) {
            selectedToday = normalizedStart;
        }

        // 中文注释：快速统计的“本周/本月”以数据库 current_date 为准；today 可按单日筛选变更
        const { currentToday, today, thisWeekStartStr, thisMonthStartStr, todayStats, weekStats, monthStats } =
            await getQuickStatsSummary(selectedToday || null);
        const todayLabel = selectedToday ? `${today} 收入` : '今日收入';

        console.log('📅 日期范围:', { today, currentToday, thisWeekStartStr, thisMonthStartStr });

        console.log('📊 统计结果:', { todayStats, weekStats, monthStats });

        res.json({
            message: '获取快速统计数据成功',
            data: {
                today: {
                    ...todayStats,
                    period: 'today',
                    date: today,
                    label: todayLabel
                },
                thisWeek: {
                    ...weekStats,
                    period: 'thisWeek',
                    startDate: thisWeekStartStr,
                    endDate: currentToday
                },
                thisMonth: {
                    ...monthStats,
                    period: 'thisMonth',
                    startDate: thisMonthStartStr,
                    endDate: currentToday
                }
            }
        });
        console.log('✅ 快速统计响应发送成功');
    } catch (error) {
        console.error('❌ 获取快速统计数据失败:', error);
        res.status(500).json({
            message: '获取快速统计数据失败',
            error: error.message
        });
    }
});

/**
 * 获取账单明细（支持多条件过滤）
 * GET /api/revenue/bills?date=YYYY-MM-DD&roomNumber=101&orderId=ORD&guestName=张三&payWay=微信&changeType=补收
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getRevenueBills(params)`
 * - `frontend/src/pages/Revenue/composables/useDetailedBills.js`：`fetchData()`（DetailedBillTable）
 * - `frontend/src/pages/Revenue/components/DetailedBillTable.vue`：详细收入数据表格
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/DetailedBillTable.vue`：底部「详细收入数据」QTable（rows/columns）
 */
router.get('/bills', async (req, res) => {
    try {
        const {
            date: queryDate,
            roomNumber,
            orderId,
            guestName,
            payWay,
            changeType
        } = req.query;

        // 单日过滤参数校验
        if (queryDate && !isDateString(queryDate)) {
            return res.status(400).json({
                success: false,
                message: 'date 日期格式错误，请使用YYYY-MM-DD'
            });
        }

        // 字符串参数统一去空格，避免输入首尾空格导致筛选异常
        const sanitizedRoomNumber = roomNumber ? String(roomNumber).trim() : undefined;
        const sanitizedOrderId = orderId ? String(orderId).trim() : undefined;
        const sanitizedGuestName = guestName ? String(guestName).trim() : undefined;
        const sanitizedPayWay = payWay ? String(payWay).trim() : undefined;
        const sanitizedChangeType = changeType ? String(changeType).trim() : undefined;

        const bills = await getRevenueBillDetails({
            date: queryDate || undefined,
            roomNumber: sanitizedRoomNumber || undefined,
            orderId: sanitizedOrderId || undefined,
            guestName: sanitizedGuestName || undefined,
            payWay: sanitizedPayWay || undefined,
            changeType: sanitizedChangeType || undefined
        });

        res.json({
            success: true,
            data: bills
        });
    } catch (error) {
        console.error('获取收入账单明细失败:', error);
        res.status(500).json({
            success: false,
            message: '获取收入账单明细失败',
            error: error.message
        });
    }
});



/**
 * 获取每日营收明细（统一收入口径）
 * GET /api/revenue/daily-details
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @param {string} roomType - 房型筛选 (可选)
 * 前端使用位置：
 * - `frontend/src/pages/Revenue/composables/useDailyReceipts.js`：`fetchReceipts()`（当前请求的是该接口）
 * - `frontend/src/pages/Revenue/components/RevenueTrendAnalysis.vue`：watch(dateRange/roomType) 触发刷新表格
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/RevenueTrendAnalysis.vue`：顶部「每日营收明细」QTable（按房间号搜索、展示支付方式 chip）
 */
router.get('/daily-details', async (req, res) => {
    try {
        const { startDate, endDate, roomType } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '缺少必需的参数: startDate, endDate'
            });
        }

        // 日期格式验证
        if (!isDateString(startDate) || !isDateString(endDate)) {
            return res.status(400).json({
                success: false,
                message: '日期格式错误，请使用YYYY-MM-DD格式'
            });
        }

        console.log('获取每日营收明细(orders + bills补收/租车):', { startDate, endDate, roomType });

        // 中文注释：
        // - 订单房费收入：orders.total_price（按 stay_date）
        // - 订单补收收入：bills.change_type='补收'（按 DATE(create_time)）
        // - 租车收入：bills.stay_type='租车收入'（按 DATE(create_time)）
        // - roomType 过滤只作用于可归属房型收入（租车收入无房型归属，筛选房型时不计入）
        const sql = `
            WITH order_income AS (
                SELECT
                    o.order_id::text AS id,
                    o.order_id::text AS order_number,
                    o.room_number,
                    o.guest_name,
                    o.room_type,
                    rt.type_name AS room_type_name,
                    o.stay_date::date AS stay_date,
                    COALESCE(o.total_price, 0) AS total_amount,
                    o.payment_method,
                    o.check_out_date,
                    1 AS sort_type
                FROM orders o
                LEFT JOIN room_types rt ON o.room_type = rt.type_code
                WHERE o.stay_date::date BETWEEN $1::date AND $2::date
                  AND o.status NOT IN ('cancelled')
                  AND ($3::text IS NULL OR o.room_type = $3::text)
            ),
            bill_income AS (
                SELECT
                    ('BILL-' || b.bill_id)::text AS id,
                    COALESCE(b.order_id, ('CAR-' || b.bill_id)::text) AS order_number,
                    COALESCE(b.room_number, '租车收入') AS room_number,
                    COALESCE(b.guest_name, '未知客户') AS guest_name,
                    CASE
                        WHEN COALESCE(b.stay_type, '') = '租车收入' THEN NULL
                        ELSE ord.room_type
                    END AS room_type,
                    CASE
                        WHEN COALESCE(b.stay_type, '') = '租车收入' THEN '租车收入'
                        ELSE COALESCE(rt.type_name, ord.room_type)
                    END AS room_type_name,
                    DATE(b.create_time) AS stay_date,
                    COALESCE(b.change_price, 0) AS total_amount,
                    b.pay_way AS payment_method,
                    NULL::date AS check_out_date,
                    2 AS sort_type
                FROM bills b
                LEFT JOIN LATERAL (
                    SELECT
                        o.room_type
                    FROM orders o
                    WHERE o.order_id = b.order_id
                    ORDER BY o.stay_date DESC NULLS LAST, o.create_time DESC NULLS LAST
                    LIMIT 1
                ) ord ON TRUE
                LEFT JOIN room_types rt ON rt.type_code = ord.room_type
                WHERE DATE(b.create_time) BETWEEN $1::date AND $2::date
                  AND COALESCE(b.change_price, 0) > 0
                  AND (
                    b.change_type = '补收'
                    OR COALESCE(b.stay_type, '') = '租车收入'
                  )
                  AND (
                    $3::text IS NULL
                    OR (
                        COALESCE(b.stay_type, '') <> '租车收入'
                        AND ord.room_type = $3::text
                    )
                  )
            )
            SELECT
                id,
                order_number,
                room_number,
                guest_name,
                room_type,
                room_type_name,
                stay_date,
                total_amount,
                payment_method,
                check_out_date
            FROM (
                SELECT * FROM order_income
                UNION ALL
                SELECT * FROM bill_income
            ) t
            ORDER BY stay_date DESC, sort_type ASC, room_number ASC, order_number ASC
        `;

        const result = await query(sql, [startDate, endDate, roomType || null]);

        const filteredDetails = (result.rows || []).map(row => ({
            id: row.id,
            order_number: row.order_number,
            room_number: row.room_number,
            guest_name: row.guest_name || '未知客户',
            room_type: row.room_type,
            room_type_name: row.room_type_name || row.room_type,
            total_amount: parseFloat(row.total_amount || 0),
            payment_method: row.payment_method,
            stay_date: String(row.stay_date || ''),
            check_out_date: row.check_out_date ? String(row.check_out_date) : '',
            stay_date_display: String(row.stay_date || '')
        }));

        res.json({
            success: true,
            data: filteredDetails,
            message: `获取每日营收明细成功，共 ${filteredDetails.length} 条记录`
        });

    } catch (error) {
        console.error('获取每日营收明细失败:', error);
        res.status(500).json({
            success: false,
            message: '获取每日营收明细失败: ' + error.message
        });
    }
});


/**
 * 获取收款明细 (基于bills表)
 * GET /api/revenue/receipts
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * 前端使用位置：
 * - 当前前端未直接调用（全局搜索未发现 `/revenue/receipts` 或 revenueApi 对应方法）。
 * - 可作为“按收款时间(create_time)聚合”的明细接口被复用（与 `/daily-details` 的 stay_date 口径不同）。
 * 前端展示位置：
 * - 当前暂无页面直接展示该接口返回数据（可在收入统计页新增 Tab/表格后接入）。
 */
router.get('/receipts', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '缺少必需的参数: startDate, endDate'
            });
        }

        // SQL查询 (按日和订单号聚合bills)
        const sql = `
            SELECT
                to_char(b.create_time, 'YYYY-MM-DD') as bill_date,
                b.order_id,
                b.room_number,
                MAX(b.guest_name) as guest_name,
                SUM(b.change_price) as total_amount,
                b.pay_way as payment_method,
                MAX(o.room_type) as room_type,
                MAX(rt.type_name) as room_type_name,
                MAX(o.check_in_date) as stay_date,
                MAX(o.check_out_date) as check_out_date,
                MIN(b.create_time) as created_at
            FROM bills b
            LEFT JOIN orders o ON b.order_id = o.order_id
            LEFT JOIN room_types rt ON o.room_type = rt.type_code
            WHERE b.create_time::date >= $1::date
              AND b.create_time::date <= $2::date
            GROUP BY to_char(b.create_time, 'YYYY-MM-DD'), b.order_id ,b.room_number, b.pay_way
            ORDER BY bill_date DESC, created_at DESC
        `;

        console.log('执行收款明细查询(bills):', { startDate, endDate });

        const result = await query(sql, [startDate, endDate]);

        // 格式化数据
        const receipts = result.rows.map(row => ({
            id: row.order_id,
            order_number: row.order_id,
            room_number: row.room_number,
            guest_name: row.guest_name || '未知客户',
            room_type: row.room_type,
            room_type_name: row.room_type_name,
            total_amount: parseFloat(row.total_amount || 0),
            payment_method: row.payment_method,
            stay_date: row.stay_date,
            check_out_date: row.check_out_date,
            created_at: row.created_at,
            bill_date: row.bill_date
        }));

        res.json({
            success: true,
            data: receipts,
            message: `获取收款明细成功`
        });

    } catch (error) {
        console.error('获取收款明细失败:', error);
        res.status(500).json({
            success: false,
            message: '获取收款明细失败: ' + error.message,
            // 中文注释：不使用 toISOString() 直接返回给前端，避免时区/格式差异
            timestamp: Date.now()
        });
    }
});


module.exports = router;
