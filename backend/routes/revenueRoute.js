const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isDateString = (value) => DATE_REGEX.test(String(value || ''));

/**
 * 获取收款明细 (基于bills表)
 * GET /api/revenue/receipts
 * 当前收入统计页面未直接调用；先保留在旧路由，避免把未使用接口混入页面模块边界。
 */
router.get('/receipts', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '缺少必需的参数: startDate, endDate'
            });
        }

        if (!isDateString(startDate) || !isDateString(endDate)) {
            return res.status(400).json({
                success: false,
                message: '日期格式错误，请使用YYYY-MM-DD格式'
            });
        }

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

        const result = await query(sql, [String(startDate), String(endDate)]);

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
            message: '获取收款明细成功'
        });

    } catch (error) {
        console.error('获取收款明细失败:', error);
        res.status(500).json({
            success: false,
            message: '获取收款明细失败: ' + error.message,
            timestamp: Date.now()
        });
    }
});

module.exports = router;
