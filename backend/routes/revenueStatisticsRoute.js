const express = require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

/**
 * 获取收款明细
 * GET /api/revenue-statistics/receipts
 * @param {string} type - 收款类型 ('hotel' 客房住宿, 'rest' 休息房)
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 */
router.get('/receipts', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    // 参数验证
    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的参数: type, startDate, endDate'
      });
    }

    if (!['hotel', 'rest'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type 参数必须是 hotel 或 rest'
      });
    }

    // 构建查询条件
    let stayTypeCondition = '';
    if (type === 'hotel') {
      // 客房住宿：跨日期订单或房价>150元
      stayTypeCondition = `AND (
        check_out_date::date != check_in_date::date
        OR total_price > 150
      )`;
    } else if (type === 'rest') {
      // 休息房：当日订单且房价≤150元
      stayTypeCondition = `AND (
        check_out_date::date = check_in_date::date
        AND total_price <= 150
      )`;
    }

    // SQL查询
    const sql = `
      SELECT
        o.order_id,
        o.order_id as order_number,
        o.room_number,
        o.guest_name,
        o.total_price as room_fee,
        o.deposit,
        (o.total_price + o.deposit) as total_amount,
        o.payment_method,
        o.check_in_date as stay_date,
        o.check_out_date,
        o.create_time as created_at
      FROM orders o
      WHERE o.check_in_date::date >= $1::date
        AND o.check_in_date::date <= $2::date
        AND o.status != 'cancelled'
        ${stayTypeCondition}
      ORDER BY o.check_in_date DESC, o.create_time DESC
    `;

    console.log('执行收款明细查询:', {
      type,
      startDate,
      endDate,
      sql: sql.replace(/\s+/g, ' ').trim()
    });

    const result = await query(sql, [startDate, endDate]);

    // 格式化数据
    const receipts = result.rows.map(row => ({
      id: row.order_id,
      order_number: row.order_number || row.order_id,
      room_number: row.room_number,
      guest_name: row.guest_name || '未知客户',
      room_fee: parseFloat(row.room_fee || 0),
      deposit: parseFloat(row.deposit || 0),
      total_amount: parseFloat(row.total_amount || 0),
      payment_method: row.payment_method || 'cash',
      stay_date: row.stay_date,
      check_out_date: row.check_out_date,
      created_at: row.created_at
    }));

    console.log(`查询完成，返回 ${receipts.length} 条${type === 'hotel' ? '客房' : '休息房'}收款明细`);

    res.json({
      success: true,
      data: receipts,
      message: `获取${type === 'hotel' ? '客房' : '休息房'}收款明细成功`
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

/**
 * 获取收款统计汇总
 * GET /api/revenue-statistics/summary
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 */
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 参数验证
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的参数: startDate, endDate'
      });
    }

    // 获取客房和休息房的汇总数据
    const sql = `
      SELECT
        CASE
          WHEN check_out_date::date != check_in_date::date OR total_price > 150 THEN 'hotel'
          ELSE 'rest'
        END as receipt_type,
        COUNT(*) as order_count,
        SUM(total_price) as total_room_fee,
        SUM(deposit) as total_deposit,
        SUM(total_price + deposit) as total_amount,
        payment_method,
        COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_count,
        COUNT(CASE WHEN payment_method = 'wechat' THEN 1 END) as wechat_count,
        COUNT(CASE WHEN payment_method = 'alipay' THEN 1 END) as alipay_count,
        SUM(CASE WHEN payment_method = 'cash' THEN total_price + deposit ELSE 0 END) as cash_amount,
        SUM(CASE WHEN payment_method = 'wechat' THEN total_price + deposit ELSE 0 END) as wechat_amount,
        SUM(CASE WHEN payment_method = 'alipay' THEN total_price + deposit ELSE 0 END) as alipay_amount
      FROM orders
      WHERE check_in_date::date >= $1::date
        AND check_in_date::date <= $2::date
        AND status != 'cancelled'
      GROUP BY receipt_type, payment_method
      ORDER BY receipt_type, payment_method
    `;

    const result = await query(sql, [startDate, endDate]);

    res.json({
      success: true,
      data: result.rows,
      message: '获取收款统计汇总成功'
    });

  } catch (error) {
    console.error('获取收款统计汇总失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收款统计汇总失败: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
