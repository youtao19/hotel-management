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
            DATE(create_time) as date,
            COUNT(*) as order_count,
            SUM(COALESCE(total_income, 0)) as total_revenue,
            SUM(CASE WHEN refund_deposit = true THEN COALESCE(deposit, 0) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(room_fee, 0)) as total_room_fee,
            COUNT(CASE WHEN pay_way = '现金' THEN 1 END) as cash_orders,
            COUNT(CASE WHEN pay_way = '微信' THEN 1 END) as wechat_orders,
            COUNT(CASE WHEN pay_way = '支付宝' THEN 1 END) as alipay_orders,
            COUNT(CASE WHEN pay_way = '信用卡' THEN 1 END) as credit_card_orders,
            SUM(CASE WHEN pay_way = '现金' THEN COALESCE(total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN pay_way = '微信' THEN COALESCE(total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN pay_way = '支付宝' THEN COALESCE(total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN pay_way = '信用卡' THEN COALESCE(total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM bills 
        WHERE DATE(create_time) BETWEEN $1 AND $2
        GROUP BY DATE(create_time)
        ORDER BY DATE(create_time) DESC
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
            DATE_TRUNC('week', create_time) as week_start,
            DATE_TRUNC('week', create_time) + INTERVAL '6 days' as week_end,
            EXTRACT(year FROM create_time) as year,
            EXTRACT(week FROM create_time) as week_number,
            COUNT(*) as order_count,
            SUM(COALESCE(total_income, 0)) as total_revenue,
            SUM(CASE WHEN refund_deposit = true THEN COALESCE(deposit, 0) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(room_fee, 0)) as total_room_fee,
            AVG(COALESCE(total_income, 0)) as avg_daily_revenue,
            COUNT(CASE WHEN pay_way = '现金' THEN 1 END) as cash_orders,
            COUNT(CASE WHEN pay_way = '微信' THEN 1 END) as wechat_orders,
            COUNT(CASE WHEN pay_way = '支付宝' THEN 1 END) as alipay_orders,
            COUNT(CASE WHEN pay_way = '信用卡' THEN 1 END) as credit_card_orders,
            SUM(CASE WHEN pay_way = '现金' THEN COALESCE(total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN pay_way = '微信' THEN COALESCE(total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN pay_way = '支付宝' THEN COALESCE(total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN pay_way = '信用卡' THEN COALESCE(total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM bills 
        WHERE DATE(create_time) BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('week', create_time), EXTRACT(year FROM create_time), EXTRACT(week FROM create_time)
        ORDER BY DATE_TRUNC('week', create_time) DESC
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
            DATE_TRUNC('month', create_time) as month_start,
            EXTRACT(year FROM create_time) as year,
            EXTRACT(month FROM create_time) as month,
            COUNT(*) as order_count,
            SUM(COALESCE(total_income, 0)) as total_revenue,
            SUM(CASE WHEN refund_deposit = true THEN COALESCE(deposit, 0) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(room_fee, 0)) as total_room_fee,
            AVG(COALESCE(total_income, 0)) as avg_daily_revenue,
            COUNT(CASE WHEN pay_way = '现金' THEN 1 END) as cash_orders,
            COUNT(CASE WHEN pay_way = '微信' THEN 1 END) as wechat_orders,
            COUNT(CASE WHEN pay_way = '支付宝' THEN 1 END) as alipay_orders,
            COUNT(CASE WHEN pay_way = '信用卡' THEN 1 END) as credit_card_orders,
            SUM(CASE WHEN pay_way = '现金' THEN COALESCE(total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN pay_way = '微信' THEN COALESCE(total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN pay_way = '支付宝' THEN COALESCE(total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN pay_way = '信用卡' THEN COALESCE(total_income, 0) ELSE 0 END) as credit_card_revenue,
            -- 计算月度增长率（与上月比较）
            LAG(SUM(COALESCE(total_income, 0))) OVER (ORDER BY DATE_TRUNC('month', create_time)) as prev_month_revenue
        FROM bills 
        WHERE DATE(create_time) BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', create_time), EXTRACT(year FROM create_time), EXTRACT(month FROM create_time)
        ORDER BY DATE_TRUNC('month', create_time) DESC
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
            COUNT(*) as total_orders,
            SUM(COALESCE(total_income, 0)) as total_revenue,
            AVG(COALESCE(total_income, 0)) as avg_order_value,
            SUM(CASE WHEN refund_deposit = true THEN COALESCE(deposit, 0) ELSE 0 END) as total_deposit_refund,
            SUM(COALESCE(room_fee, 0)) as total_room_fee,
            MAX(COALESCE(total_income, 0)) as max_order_value,
            MIN(COALESCE(total_income, 0)) as min_order_value,
            -- 支付方式统计
            COUNT(CASE WHEN pay_way = '现金' THEN 1 END) as cash_orders,
            COUNT(CASE WHEN pay_way = '微信' THEN 1 END) as wechat_orders,
            COUNT(CASE WHEN pay_way = '支付宝' THEN 1 END) as alipay_orders,
            COUNT(CASE WHEN pay_way = '信用卡' THEN 1 END) as credit_card_orders,
            SUM(CASE WHEN pay_way = '现金' THEN COALESCE(total_income, 0) ELSE 0 END) as cash_revenue,
            SUM(CASE WHEN pay_way = '微信' THEN COALESCE(total_income, 0) ELSE 0 END) as wechat_revenue,
            SUM(CASE WHEN pay_way = '支付宝' THEN COALESCE(total_income, 0) ELSE 0 END) as alipay_revenue,
            SUM(CASE WHEN pay_way = '信用卡' THEN COALESCE(total_income, 0) ELSE 0 END) as credit_card_revenue
        FROM bills 
        WHERE DATE(create_time) BETWEEN $1 AND $2
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
            COUNT(*) as order_count,
            SUM(COALESCE(b.total_income, 0)) as total_revenue,
            AVG(COALESCE(b.total_income, 0)) as avg_revenue_per_order,
            SUM(COALESCE(b.room_fee, 0)) as total_room_fee,
            SUM(CASE WHEN b.refund_deposit = true THEN COALESCE(b.deposit, 0) ELSE 0 END) as total_deposit_refund
        FROM bills b
        JOIN orders o ON b.order_id = o.order_id
        LEFT JOIN room_types rt ON o.room_type = rt.type_code
        WHERE DATE(b.create_time) BETWEEN $1 AND $2
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
