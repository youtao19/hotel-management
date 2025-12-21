const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

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

const {
    getDailyRevenue,
    getWeeklyRevenue,
    getMonthlyRevenue,
    getRoomTypeRevenue,
    getRevenueBillDetails,
    getOverview,
    getWeekStartDateString,
    getMonthStartDateString
} = require('../modules/revenueModule');

/**
 * 获取每日收入统计
 * GET /api/revenue/daily?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getDailyRevenue(startDate, endDate, roomType)`
 * - `frontend/src/pages/Revenue/composables/useRevenueData.js`：`fetchMainStats()`（selectedPeriod='daily'）
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/RevenueTrendAnalysis.vue`：折线图数据源（按日趋势，渲染到 `<canvas>`）
 */
router.get('/daily', async (req, res) => {
    console.log('📊 收到每日收入统计请求');
    console.log('请求参数:', req.query);
    try {
        const parsed = requireDateRangeQuery(req, res);
        if (!parsed) {
            console.log('❌ 参数验证失败:', req.query);
            return;
        }
        const { startDate, endDate, roomType } = parsed;

        console.log('📅 开始获取每日收入数据:', { startDate, endDate, roomType });
        const dailyRevenue = await getDailyRevenue(startDate, endDate, roomType);
        console.log('✅ 每日收入数据获取成功:', dailyRevenue.length, '条记录');

        res.json({
            message: '获取每日收入统计成功',
            data: dailyRevenue,
            period: {
                startDate,
                endDate,
                type: 'daily',
                roomType: roomType || null
            }
        });
    } catch (error) {
        console.error('❌ 获取每日收入统计失败:', error);
        res.status(500).json({
            message: '获取每日收入统计失败',
            error: error.message
        });
    }
});

/**
 * 获取每周收入统计
 * GET /api/revenue/weekly?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getWeeklyRevenue(startDate, endDate, roomType)`
 * - `frontend/src/pages/Revenue/composables/useRevenueData.js`：`fetchMainStats()`（selectedPeriod='weekly'）
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/RevenueTrendAnalysis.vue`：折线图数据源（按周趋势，渲染到 `<canvas>`）
 */
router.get('/weekly', async (req, res) => {
    try {
        const parsed = requireDateRangeQuery(req, res);
        if (!parsed) return;
        const { startDate, endDate, roomType } = parsed;

        const weeklyRevenue = await getWeeklyRevenue(startDate, endDate, roomType);

        res.json({
            message: '获取每周收入统计成功',
            data: weeklyRevenue,
            period: {
                startDate,
                endDate,
                type: 'weekly',
                roomType: roomType || null
            }
        });
    } catch (error) {
        console.error('获取每周收入统计失败:', error);
        res.status(500).json({
            message: '获取每周收入统计失败',
            error: error.message
        });
    }
});

/**
 * 获取每月收入统计
 * GET /api/revenue/monthly?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getMonthlyRevenue(startDate, endDate, roomType)`
 * - `frontend/src/pages/Revenue/composables/useRevenueData.js`：`fetchMainStats()`（selectedPeriod='monthly'）
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/RevenueTrendAnalysis.vue`：折线图数据源（按月趋势，渲染到 `<canvas>`）
 */
router.get('/monthly', async (req, res) => {
    try {
        const parsed = requireDateRangeQuery(req, res);
        if (!parsed) return;
        const { startDate, endDate, roomType } = parsed;

        const monthlyRevenue = await getMonthlyRevenue(startDate, endDate, roomType);

        res.json({
            message: '获取每月收入统计成功',
            data: monthlyRevenue,
            period: {
                startDate,
                endDate,
                type: 'monthly',
                roomType: roomType || null
            }
        });
    } catch (error) {
        console.error('获取每月收入统计失败:', error);
        res.status(500).json({
            message: '获取每月收入统计失败',
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
        // - startDate/endDate：前端当前所选日期范围；当且仅当“单日”（startDate===endDate）时，首卡应展示所选日期的收入。
        // - 未传 baseDate 且非单日时，使用数据库 current_date（避免 Node.js 侧时区/Date 解析带来的偏差）。
        let today = null;
        let todayLabel = '今日收入';
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

        if (baseDate) {
            if (!isDateString(baseDate)) {
                return res.status(400).json({
                    message: '日期格式错误，请使用YYYY-MM-DD格式',
                    error: 'Invalid baseDate format'
                });
            }
            today = String(baseDate);
            todayLabel = `${today} 收入`;
        } else if (hasRange && normalizedStart === normalizedEnd) {
            today = normalizedStart;
            todayLabel = `${today} 收入`;
        } else {
            const dbNow = await query(`SELECT current_date::text AS today`, []);
            today = dbNow.rows?.[0]?.today;
        }

        // 中文注释：本周起始口径=周一
        const thisWeekStartStr = getWeekStartDateString(today);
        const thisMonthStartStr = getMonthStartDateString(today);

        console.log('📅 日期范围:', { today, thisWeekStartStr, thisMonthStartStr });

        // 并行获取今日、本周、本月数据
        const [todayStats, weekStats, monthStats] = await Promise.all([
            getOverview(today, today),
            getOverview(thisWeekStartStr, today),
            getOverview(thisMonthStartStr, today)
        ]);

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
                    endDate: today
                },
                thisMonth: {
                    ...monthStats,
                    period: 'thisMonth',
                    startDate: thisMonthStartStr,
                    endDate: today
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
 * 获取账单明细（支持日期、房间号过滤）
 * GET /api/revenue/bills?date=YYYY-MM-DD&roomNumber=101
 * 前端使用位置：
 * - `frontend/src/api/index.js`：`revenueApi.getRevenueBills(params)`
 * - `frontend/src/pages/Revenue/composables/useDetailedBills.js`：`fetchData()`（DetailedBillTable）
 * - `frontend/src/pages/Revenue/components/DetailedBillTable.vue`：详细收入数据表格
 * 前端展示位置：
 * - `frontend/src/pages/Revenue/components/DetailedBillTable.vue`：底部「详细收入数据」QTable（rows/columns）
 */
router.get('/bills', async (req, res) => {
    try {
        const { date: queryDate, roomNumber } = req.query;

        if (queryDate) {
            if (!isDateString(queryDate)) {
                return res.status(400).json({
                    success: false,
                    message: '日期格式错误，请使用YYYY-MM-DD'
                });
            }
        }

        const sanitizedRoomNumber = roomNumber ? String(roomNumber).trim() : undefined;
        const bills = await getRevenueBillDetails({
            date: queryDate || undefined,
            roomNumber: sanitizedRoomNumber || undefined
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
 * 获取每日营收明细 (基于orders订单表)
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

        console.log('获取每日营收明细(orders.total_price):', { startDate, endDate, roomType });

        // 中文注释：
        // - “每日营收明细”口径改为 orders 表（按 stay_date 展示单日房费 total_price）
        // - 排除取消订单：status='cancelled'
        // - 不从 bills 推导（bills 仅用于“详细收入数据”）
        let sql = `
            SELECT
                o.order_id,
                o.room_number,
                o.guest_name,
                o.room_type,
                rt.type_name as room_type_name,
                o.stay_date::date AS stay_date,
                COALESCE(o.total_price, 0) AS total_amount,
                o.payment_method,
                o.check_out_date
            FROM orders o
            LEFT JOIN room_types rt ON o.room_type = rt.type_code
            WHERE o.stay_date::date BETWEEN $1::date AND $2::date
              AND o.status NOT IN ('cancelled')
        `;

        const params = [startDate, endDate];

        if (roomType) {
            sql += ` AND o.room_type = $3`;
            params.push(roomType);
        }

        sql += `
            ORDER BY o.stay_date::date DESC, o.room_number ASC, o.order_id ASC
        `;

        const result = await query(sql, params);

        const filteredDetails = (result.rows || []).map(row => ({
            id: row.order_id,
            order_number: row.order_id,
            room_number: row.room_number,
            guest_name: row.guest_name || '未知客户',
            room_type: row.room_type,
            room_type_name: row.room_type_name || row.room_type,
            total_amount: parseFloat(row.total_amount || 0),
            payment_method: row.payment_method,
            stay_date: String(row.stay_date || ''),
            check_out_date: String(row.check_out_date || ''),
            stay_date_display: String(row.stay_date || '')
        })).filter(d => d.total_amount > 0);

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
