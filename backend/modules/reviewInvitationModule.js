"use strict";

const { query } = require('../database/postgreDB/pg');

/**
 * 邀请客户好评（写入 review_invitations）
 * @param {string} order_id - 订单ID
 * @returns {Promise<Object>} 订单信息（包含好评状态）
 */
async function inviteReview(order_id) {
    try {
        // UPSERT 邀请记录
        await query(`
            INSERT INTO review_invitations (order_id, invited, invite_time)
            VALUES ($1, TRUE, NOW())
            ON CONFLICT (order_id)
            DO UPDATE SET invited = EXCLUDED.invited, invite_time = EXCLUDED.invite_time
        `, [order_id]);

        // 返回订单信息（包含好评状态）
        return await getOrderWithReviewInfo(order_id);
    } catch (error) {
        console.error('邀请好评数据库错误:', error);
        throw error;
    }
}

/**
 * 更新好评状态（写入 review_invitations）
 * @param {string} order_id - 订单ID
 * @param {boolean} positive_review - 是否好评
 * @returns {Promise<Object>} 订单信息（包含好评状态）
 */
async function updateReviewStatus(order_id, positive_review) {
    try {
        await query(`
            INSERT INTO review_invitations (order_id, invited, positive_review, update_time)
            VALUES ($1, TRUE, $2, NOW())
            ON CONFLICT (order_id)
            DO UPDATE SET positive_review = EXCLUDED.positive_review, update_time = EXCLUDED.update_time
        `, [order_id, positive_review]);

        return await getOrderWithReviewInfo(order_id);
    } catch (error) {
        console.error('更新好评状态数据库错误:', error);
        throw error;
    }
}

/**
 * 获取订单及其好评信息
 * @param {string} order_id - 订单ID
 * @returns {Promise<Object>} 订单信息（包含好评状态）
 */
async function getOrderWithReviewInfo(order_id) {
    try {
        const sqlQuery = `
            SELECT o.*,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM orders o
            LEFT JOIN review_invitations ri ON ri.order_id = o.order_id
            WHERE o.order_id = $1
        `;
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0];
    } catch (error) {
        console.error('获取订单好评信息数据库错误:', error);
        throw error;
    }
}

/**
 * 获取特定订单的好评信息
 * @param {string} order_id - 订单ID
 * @returns {Promise<Object|null>} 好评信息
 */
async function getReviewByOrderId(order_id) {
    try {
        const sqlQuery = `
            SELECT ri.*
            FROM review_invitations ri
            WHERE ri.order_id = $1
        `;
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('获取好评信息数据库错误:', error);
        throw error;
    }
}

/**
 * 获取待邀请好评的订单（已退房且未邀请好评的订单）
 * 优化：直接基于订单状态查询，不依赖账单
 */
async function getPendingReviewInvitations() {
    try {
        const sqlQuery = `
            SELECT o.*,
                   COALESCE(ri.invited, FALSE) AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time
            FROM orders o
            LEFT JOIN review_invitations ri ON ri.order_id = o.order_id
            WHERE o.create_time >= (CURRENT_DATE - INTERVAL '1 day')
              AND o.create_time < (CURRENT_DATE + INTERVAL '1 day')
              AND COALESCE(ri.invited, FALSE) = FALSE
            ORDER BY o.create_time DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取待邀请好评订单数据库错误:', error);
        throw error;
    }
}

/**
 * 获取已邀请但未设置好评状态的订单
 * 优化：直接基于订单和好评表查询
 */
async function getPendingReviewUpdates() {
    try {
        const sqlQuery = `
            SELECT o.*,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM orders o
            JOIN review_invitations ri ON ri.order_id = o.order_id
            WHERE ri.invited = TRUE
              AND ri.positive_review IS NULL
            ORDER BY ri.invite_time DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取待更新好评状态订单数据库错误:', error);
        throw error;
    }
}

/**
 * 获取所有有好评记录的订单（用于统计分析）
 * @param {Object} options - 查询选项
 * @param {string} options.startDate - 开始日期
 * @param {string} options.endDate - 结束日期
 * @param {string} options.status - 好评状态过滤
 * @returns {Promise<Array>} 订单列表
 */
async function getAllReviewOrders(options = {}) {
    try {
        let whereConditions = ['ri.order_id IS NOT NULL'];
        let params = [];
        let paramIndex = 1;

        // 添加日期范围过滤
        if (options.startDate) {
            whereConditions.push(`o.check_out_date >= $${paramIndex}`);
            params.push(options.startDate);
            paramIndex++;
        }

        if (options.endDate) {
            whereConditions.push(`o.check_out_date <= $${paramIndex}`);
            params.push(options.endDate);
            paramIndex++;
        }

        // 添加好评状态过滤
        if (options.status === 'invited') {
            whereConditions.push('ri.invited = TRUE');
        } else if (options.status === 'positive') {
            whereConditions.push('ri.positive_review = TRUE');
        } else if (options.status === 'negative') {
            whereConditions.push('ri.positive_review = FALSE');
        }

        const sqlQuery = `
            SELECT o.*,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM orders o
            JOIN review_invitations ri ON ri.order_id = o.order_id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY o.check_out_date DESC, ri.invite_time DESC
        `;

        const result = await query(sqlQuery, params);
        return result.rows;
    } catch (error) {
        console.error('获取所有好评记录数据库错误:', error);
        throw error;
    }
}

/**
 * 获取好评统计信息
 * @param {Object} options - 查询选项
 * @returns {Promise<Object>} 统计数据
 */
async function getReviewStatistics(options = {}) {
    try {
        let whereConditions = ['ri.order_id IS NOT NULL'];
        let params = [];
        let paramIndex = 1;

        if (options.startDate) {
            whereConditions.push(`o.check_out_date >= $${paramIndex}`);
            params.push(options.startDate);
            paramIndex++;
        }

        if (options.endDate) {
            whereConditions.push(`o.check_out_date <= $${paramIndex}`);
            params.push(options.endDate);
            paramIndex++;
        }

        const sqlQuery = `
            SELECT
                COUNT(*) as total_invitations,
                COUNT(CASE WHEN ri.positive_review = TRUE THEN 1 END) as positive_reviews,
                COUNT(CASE WHEN ri.positive_review = FALSE THEN 1 END) as negative_reviews,
                COUNT(CASE WHEN ri.positive_review IS NULL THEN 1 END) as pending_reviews,
                ROUND(
                    COUNT(CASE WHEN ri.positive_review = TRUE THEN 1 END) * 100.0 /
                    NULLIF(COUNT(CASE WHEN ri.positive_review IS NOT NULL THEN 1 END), 0),
                    2
                ) as positive_rate
            FROM orders o
            JOIN review_invitations ri ON ri.order_id = o.order_id
            WHERE ${whereConditions.join(' AND ')}
        `;

        const result = await query(sqlQuery, params);
        return result.rows[0];
    } catch (error) {
        console.error('获取好评统计数据库错误:', error);
        throw error;
    }
}

module.exports = {
    inviteReview,
    updateReviewStatus,
    getOrderWithReviewInfo,
    getReviewByOrderId,
    getPendingReviewInvitations,
    getPendingReviewUpdates,
    getAllReviewOrders,
    getReviewStatistics
};
