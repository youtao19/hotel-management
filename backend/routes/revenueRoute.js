const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

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
 */
router.get('/daily', async (req, res) => {
    console.log('📊 收到每日收入统计请求');
    console.log('请求参数:', req.query);
    try {
        const { startDate, endDate, roomType } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            console.log('❌ 参数验证失败: 缺少日期参数');
            return res.status(400).json({
                message: '请提供开始日期和结束日期',
                error: 'startDate and endDate are required'
            });
        }

        // 日期格式验证
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            console.log('❌ 日期格式验证失败:', { startDate, endDate });
            return res.status(400).json({
                message: '日期格式错误，请使用YYYY-MM-DD格式',
                error: 'Invalid date format'
            });
        }

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
 */
router.get('/weekly', async (req, res) => {
    try {
        const { startDate, endDate, roomType } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: '请提供开始日期和结束日期',
                error: 'startDate and endDate are required'
            });
        }

        // 日期格式验证
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                message: '日期格式错误，请使用YYYY-MM-DD格式',
                error: 'Invalid date format'
            });
        }

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
 */
router.get('/monthly', async (req, res) => {
    try {
        const { startDate, endDate, roomType } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: '请提供开始日期和结束日期',
                error: 'startDate and endDate are required'
            });
        }

        // 日期格式验证
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                message: '日期格式错误，请使用YYYY-MM-DD格式',
                error: 'Invalid date format'
            });
        }

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
 * 获取收入概览统计
 * GET /api/revenue/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/overview', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: '请提供开始日期和结束日期',
                error: 'startDate and endDate are required'
            });
        }

        // 日期格式验证
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                message: '日期格式错误，请使用YYYY-MM-DD格式',
                error: 'Invalid date format'
            });
        }

        const overview = await getOverview(startDate, endDate);

        res.json({
            message: '获取收入概览成功',
            data: overview,
            period: {
                startDate,
                endDate,
                type: 'overview'
            }
        });
    } catch (error) {
        console.error('获取收入概览失败:', error);
        res.status(500).json({
            message: '获取收入概览失败',
            error: error.message
        });
    }
});

/**
 * 获取房型收入统计
 * GET /api/revenue/room-type?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/room-type', async (req, res) => {
    console.log('🏨 收到房型收入统计请求');
    console.log('请求参数:', req.query);
    try {
        const { startDate, endDate } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            console.log('❌ 参数验证失败: 缺少日期参数');
            return res.status(400).json({
                message: '请提供开始日期和结束日期',
                error: 'startDate and endDate are required'
            });
        }

        // 日期格式验证
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            console.log('❌ 日期格式验证失败:', { startDate, endDate });
            return res.status(400).json({
                message: '日期格式错误，请使用YYYY-MM-DD格式',
                error: 'Invalid date format'
            });
        }

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
 */
router.get('/quick-stats', async (req, res) => {
    console.log('🚀 收到快速统计请求');
    try {
        const { baseDate } = req.query;

        // 中文注释：baseDate 用于测试/对账（例如使用交接班测试 SQL 数据时，可指定某一天作为“今日”）。
        // 未传 baseDate 时使用数据库 current_date（避免 Node.js 侧时区/Date 解析带来的偏差）。
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        let today = null;
        if (baseDate) {
            if (!dateRegex.test(baseDate)) {
                return res.status(400).json({
                    message: '日期格式错误，请使用YYYY-MM-DD格式',
                    error: 'Invalid baseDate format'
                });
            }
            today = String(baseDate);
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
                    date: today
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
 */
router.get('/bills', async (req, res) => {
    try {
        const { date: queryDate, roomNumber } = req.query;

        if (queryDate) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(queryDate)) {
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
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: '日期格式错误，请使用YYYY-MM-DD格式'
            });
        }

        console.log('获取每日营收明细(bills房费):', { startDate, endDate, roomType });

        // 中文注释：
        // - “每日营收明细”按 bills.stay_date 展示每天实际房费（不做均分）
        // - 只统计 change_type='房费'，明确排除押金/收押
        let sql = `
            SELECT
                b.order_id,
                b.room_number,
                MAX(b.guest_name) AS guest_name,
                o.room_type,
                rt.type_name as room_type_name,
                b.stay_date::date AS stay_date,
                SUM(COALESCE(b.change_price,0)) AS total_amount,
                MAX(b.pay_way) as payment_method,
                o.check_out_date
            FROM bills b
            JOIN orders o ON o.order_id = b.order_id
            LEFT JOIN room_types rt ON o.room_type = rt.type_code
            WHERE b.change_type = '房费'
              AND b.stay_date::date BETWEEN $1::date AND $2::date
              AND o.status NOT IN ('cancelled')
        `;

        const params = [startDate, endDate];

        if (roomType) {
            sql += ` AND o.room_type = $3`;
            params.push(roomType);
        }

        sql += `
            GROUP BY b.order_id, b.room_number, o.room_type, rt.type_name, b.stay_date::date, o.check_out_date
            ORDER BY b.stay_date::date DESC, b.room_number ASC, b.order_id ASC
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
