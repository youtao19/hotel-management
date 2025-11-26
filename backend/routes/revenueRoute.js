const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

const {
    getDailyRevenue,
    getWeeklyRevenue,
    getMonthlyRevenue,
    getRoomTypeRevenue,
    getRevenueBillDetails,
    getOverview
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
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const fmt = d => formatter.format(d);

        const now = new Date();
        const today = fmt(now);

        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
        const thisWeekStartStr = fmt(thisWeekStart);

        const thisMonthStart = new Date(now);
        thisMonthStart.setDate(1);
        const thisMonthStartStr = fmt(thisMonthStart);

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

        console.log('获取每日营收明细(订单表):', { startDate, endDate, roomType });

        // 从订单表获取数据，使用与 getOverview 相同的逻辑
        // 查询与日期区间有交集的订单
        let sql = `
            SELECT
                o.order_id,
                o.room_number,
                o.guest_name,
                o.room_type,
                rt.type_name as room_type_name,
                o.total_price,
                o.deposit,
                o.payment_method,
                o.check_in_date,
                o.check_out_date,
                o.status,
                o.order_source
            FROM orders o
            LEFT JOIN room_types rt ON o.room_type = rt.type_code
            WHERE (
                (
                    o.check_in_date::date <= $2::date
                    AND o.check_out_date::date > $1::date
                )
                OR (
                    o.check_in_date::date = o.check_out_date::date
                    AND o.check_in_date::date BETWEEN $1::date AND $2::date
                )
            )
            AND o.status NOT IN ('cancelled')
        `;

        const params = [startDate, endDate];

        if (roomType) {
            sql += ` AND o.room_type = $3`;
            params.push(roomType);
        }

        sql += ` ORDER BY o.check_in_date DESC, o.room_number ASC`;

        const result = await query(sql, params);

        // 计算每个订单在查询区间内的收入（按天均分）
        const Decimal = require('decimal.js');
        const DAY_MS = 24 * 60 * 60 * 1000;

        const formatDateOnly = (dateInput) => {
            const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            return formatter.format(d);
        };

        const diffDays = (date1, date2) => {
            const [y1, m1, d1] = date1.split('-').map(Number);
            const [y2, m2, d2] = date2.split('-').map(Number);
            const t1 = Date.UTC(y1, m1 - 1, d1);
            const t2 = Date.UTC(y2, m2 - 1, d2);
            return Math.round((t2 - t1) / DAY_MS);
        };

        const addDays = (dateStr, days) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(Date.UTC(y, m - 1, d));
            date.setUTCDate(date.getUTCDate() + days);
            return formatDateOnly(date);
        };

        const details = result.rows.map(row => {
            const roomFee = new Decimal(row.total_price || 0);
            const checkInStr = formatDateOnly(row.check_in_date);
            const checkOutStr = formatDateOnly(row.check_out_date);
            const isRestRoom = checkInStr === checkOutStr;

            // 计算订单的入住天数
            let nights = diffDays(checkInStr, checkOutStr);
            nights = nights >= 1 ? nights : 1;

            // 计算订单在查询区间内的重叠天数
            const overlapStart = checkInStr > startDate ? checkInStr : startDate;
            const overlapEndCandidate = addDays(endDate, 1);
            const overlapEnd = checkOutStr < overlapEndCandidate ? checkOutStr : overlapEndCandidate;

            const overlapDays = isRestRoom
                ? (overlapStart <= overlapEnd ? 1 : 0)
                : diffDays(overlapStart, overlapEnd);

            // 均分房费
            const perNightRoomFee = roomFee.div(nights);
            const contribution = perNightRoomFee.times(Math.max(0, overlapDays));

            // 支付方式标准化
            let paymentMethodLabel = '现金';
            const pm = String(row.payment_method || '').toLowerCase().trim();
            if (pm.includes('微') && pm.includes('信') || pm.includes('wechat')) paymentMethodLabel = '微信';
            else if (pm.includes('邮付') || pm.includes('ali') || pm.includes('支付宝')) paymentMethodLabel = '微邮付';
            else if (pm === '平台' || pm.includes('平台')) paymentMethodLabel = '平台';
            else if (pm === '微信') paymentMethodLabel = '微信';
            else if (pm === '微邮付') paymentMethodLabel = '微邮付';
            else if (pm === '现金' || pm.includes('cash')) paymentMethodLabel = '现金';

            return {
                id: row.order_id,
                order_number: row.order_id,
                room_number: row.room_number,
                guest_name: row.guest_name || '未知客户',
                room_type: row.room_type,
                room_type_name: row.room_type_name || row.room_type,
                total_amount: Number(contribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()),
                payment_method: paymentMethodLabel,
                stay_date: checkInStr,
                check_out_date: checkOutStr,
                stay_date_display: checkInStr,
                order_source: row.order_source,
                nights: nights,
                overlap_days: overlapDays
            };
        });

        // 过滤掉贡献为0的记录
        const filteredDetails = details.filter(d => d.total_amount > 0);

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
            timestamp: new Date().toISOString()
        });
    }
});


module.exports = router;
