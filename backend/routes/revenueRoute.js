const express = require('express');
const router = express.Router();
const {
    getDailyRevenue,
    getWeeklyRevenue,
    getMonthlyRevenue,
    getRevenueOverview,
    getRoomTypeRevenue
} = require('../modules/revenueModule');

/**
 * 获取每日收入统计
 * GET /api/revenue/daily?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/daily', async (req, res) => {
    console.log('📊 收到每日收入统计请求');
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

        console.log('📅 开始获取每日收入数据:', { startDate, endDate });
        const dailyRevenue = await getDailyRevenue(startDate, endDate);
        console.log('✅ 每日收入数据获取成功:', dailyRevenue.length, '条记录');

        res.json({
            message: '获取每日收入统计成功',
            data: dailyRevenue,
            period: {
                startDate,
                endDate,
                type: 'daily'
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

        const weeklyRevenue = await getWeeklyRevenue(startDate, endDate);

        res.json({
            message: '获取每周收入统计成功',
            data: weeklyRevenue,
            period: {
                startDate,
                endDate,
                type: 'weekly'
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

        const monthlyRevenue = await getMonthlyRevenue(startDate, endDate);

        res.json({
            message: '获取每月收入统计成功',
            data: monthlyRevenue,
            period: {
                startDate,
                endDate,
                type: 'monthly'
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

        const overview = await getRevenueOverview(startDate, endDate);

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
 */
router.get('/quick-stats', async (req, res) => {
    console.log('🚀 收到快速统计请求');
    try {
        const today = new Date().toISOString().split('T')[0];
        const thisWeekStart = new Date();
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
        const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];

        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0];

        console.log('📅 日期范围:', { today, thisWeekStartStr, thisMonthStartStr });

        // 并行获取今日、本周、本月数据
        const [todayStats, weekStats, monthStats] = await Promise.all([
            getRevenueOverview(today, today),
            getRevenueOverview(thisWeekStartStr, today),
            getRevenueOverview(thisMonthStartStr, today)
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

module.exports = router;
