"use strict";

const { query } = require('../database/postgreDB/pg');

/**
 * 获取每日收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 每日收入统计数据
 */
async function getDailyRevenue(startDate, endDate) {
    const sqlQuery = `
        SELECT
            DATE(o.check_in_date) as date,
            COUNT(DISTINCT o.order_id) as order_count,
            COUNT(b.order_id) as bill_count,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            SUM(CASE WHEN COALESCE(b.refund_deposit,0) < 0 THEN ABS(COALESCE(b.refund_deposit,0)) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            COUNT(DISTINCT CASE WHEN b.pay_way = '现金' THEN o.order_id END) as cash_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微信' THEN o.order_id END) as wechat_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微邮付' THEN o.order_id END) as alipay_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '信用卡' THEN o.order_id END) as credit_card_orders,
            SUM(CASE WHEN b.pay_way = '现金' THEN COALESCE(b.total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN b.pay_way = '微信' THEN COALESCE(b.total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN b.pay_way = '微邮付' THEN COALESCE(b.total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN b.pay_way = '信用卡' THEN COALESCE(b.total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM orders o
        LEFT JOIN bills b ON b.order_id = o.order_id
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        GROUP BY DATE(o.check_in_date)
        ORDER BY DATE(o.check_in_date) DESC
    `;

    try {
        const result = await query(sqlQuery, [startDate, endDate]);
        return result.rows;
    } catch (error) {
        console.error('获取每日收入统计数据库错误:', error);
        throw error;
    }
}

/**
 * 获取每周收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 每周收入统计数据
 */
async function getWeeklyRevenue(startDate, endDate) {
    const sqlQuery = `
        SELECT
            DATE_TRUNC('week', o.check_in_date) as week_start,
            DATE_TRUNC('week', o.check_in_date) + INTERVAL '6 days' as week_end,
            EXTRACT(year FROM o.check_in_date) as year,
            EXTRACT(week FROM o.check_in_date) as week_number,
            COUNT(DISTINCT o.order_id) as order_count,
            COUNT(b.order_id) as bill_count,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            SUM(CASE WHEN COALESCE(b.refund_deposit,0) < 0 THEN ABS(COALESCE(b.refund_deposit,0)) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            AVG(COALESCE(b.total_income, 0)) as avg_daily_revenue,
            COUNT(DISTINCT CASE WHEN b.pay_way = '现金' THEN o.order_id END) as cash_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微信' THEN o.order_id END) as wechat_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微邮付' THEN o.order_id END) as alipay_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '信用卡' THEN o.order_id END) as credit_card_orders,
            SUM(CASE WHEN b.pay_way = '现金' THEN COALESCE(b.total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN b.pay_way = '微信' THEN COALESCE(b.total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN b.pay_way = '微邮付' THEN COALESCE(b.total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN b.pay_way = '信用卡' THEN COALESCE(b.total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM orders o
        LEFT JOIN bills b ON b.order_id = o.order_id
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('week', o.check_in_date), EXTRACT(year FROM o.check_in_date), EXTRACT(week FROM o.check_in_date)
        ORDER BY DATE_TRUNC('week', o.check_in_date) DESC
    `;

    try {
        const result = await query(sqlQuery, [startDate, endDate]);
        return result.rows;
    } catch (error) {
        console.error('获取每周收入统计数据库错误:', error);
        throw error;
    }
}

/**
 * 获取每月收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 每月收入统计数据
 */
async function getMonthlyRevenue(startDate, endDate) {
    const sqlQuery = `
        SELECT
            DATE_TRUNC('month', o.check_in_date) as month_start,
            EXTRACT(year FROM o.check_in_date) as year,
            EXTRACT(month FROM o.check_in_date) as month,
            COUNT(DISTINCT o.order_id) as order_count,
            COUNT(b.order_id) as bill_count,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            SUM(CASE WHEN COALESCE(b.refund_deposit,0) < 0 THEN ABS(COALESCE(b.refund_deposit,0)) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            AVG(COALESCE(b.total_income, 0)) as avg_daily_revenue,
            COUNT(DISTINCT CASE WHEN b.pay_way = '现金' THEN o.order_id END) as cash_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微信' THEN o.order_id END) as wechat_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微邮付' THEN o.order_id END) as alipay_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '信用卡' THEN o.order_id END) as credit_card_orders,
            SUM(CASE WHEN b.pay_way = '现金' THEN COALESCE(b.total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN b.pay_way = '微信' THEN COALESCE(b.total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN b.pay_way = '微邮付' THEN COALESCE(b.total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN b.pay_way = '信用卡' THEN COALESCE(b.total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM orders o
        LEFT JOIN bills b ON b.order_id = o.order_id
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', o.check_in_date), EXTRACT(year FROM o.check_in_date), EXTRACT(month FROM o.check_in_date)
        ORDER BY DATE_TRUNC('month', o.check_in_date) DESC
    `;

    try {
        const result = await query(sqlQuery, [startDate, endDate]);

        // 计算增长率
        const processedResult = result.rows.map(row => {
            let growth_rate = null;
            if (row.prev_month_revenue && row.prev_month_revenue > 0) {
                growth_rate = ((row.total_revenue - row.prev_month_revenue) / row.prev_month_revenue * 100).toFixed(2);
            }
            return {
                ...row,
                growth_rate: growth_rate
            };
        });

        return processedResult;
    } catch (error) {
        console.error('获取每月收入统计数据库错误:', error);
        throw error;
    }
}

/**
 * 获取收入概览统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Object>} 收入概览数据
 */
async function getRevenueOverview(startDate, endDate) {
    const sqlQuery = `
        SELECT
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            AVG(COALESCE(b.total_income, 0)) as avg_order_value,
            SUM(CASE WHEN COALESCE(b.refund_deposit,0) < 0 THEN ABS(COALESCE(b.refund_deposit,0)) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            MAX(COALESCE(b.total_income, 0)) as max_order_value,
            MIN(COALESCE(b.total_income, 0)) as min_order_value,
            COUNT(DISTINCT CASE WHEN b.pay_way = '现金' THEN o.order_id END) as cash_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微信' THEN o.order_id END) as wechat_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '微邮付' THEN o.order_id END) as alipay_orders,
            COUNT(DISTINCT CASE WHEN b.pay_way = '信用卡' THEN o.order_id END) as credit_card_orders,
            SUM(CASE WHEN b.pay_way = '现金' THEN COALESCE(b.total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN b.pay_way = '微信' THEN COALESCE(b.total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN b.pay_way = '微邮付' THEN COALESCE(b.total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN b.pay_way = '信用卡' THEN COALESCE(b.total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM orders o
        LEFT JOIN bills b ON b.order_id = o.order_id
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
    `;

    try {
        const result = await query(sqlQuery, [startDate, endDate]);
        return result.rows[0];
    } catch (error) {
        console.error('获取收入概览数据库错误:', error);
        throw error;
    }
}

/**
 * 获取房型收入统计
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Array>} 房型收入统计数据
 */
async function getRoomTypeRevenue(startDate, endDate) {
    const sqlQuery = `
        SELECT
            o.room_type,
            rt.type_name,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            AVG(COALESCE(b.total_income, 0)) as avg_revenue_per_order,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            SUM(CASE WHEN COALESCE(b.refund_deposit,0) < 0 THEN ABS(COALESCE(b.refund_deposit,0)) ELSE 0 END) as total_deposit_refund
        FROM orders o
        LEFT JOIN bills b ON b.order_id = o.order_id
        LEFT JOIN room_types rt ON o.room_type = rt.type_code
        WHERE DATE(o.check_in_date) BETWEEN $1 AND $2
        GROUP BY o.room_type, rt.type_name
        ORDER BY total_revenue DESC
    `;

    try {
        const result = await query(sqlQuery, [startDate, endDate]);
        return result.rows;
    } catch (error) {
        console.error('获取房型收入统计数据库错误:', error);
        throw error;
    }
}

module.exports = {
    getDailyRevenue,
    getWeeklyRevenue,
    getMonthlyRevenue,
    getRevenueOverview,
    getRoomTypeRevenue
};
