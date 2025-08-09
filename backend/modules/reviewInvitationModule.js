"use strict";

const { query } = require('../database/postgreDB/pg');
const billModule = require('./billModule');

// 邀请客户好评（写入 review_invitations）
async function inviteReview(order_id) {
    try {
        // UPSERT 邀请记录
        await query(`
            INSERT INTO review_invitations (order_id, invited, invite_time)
            VALUES ($1, TRUE, NOW())
            ON CONFLICT (order_id)
            DO UPDATE SET invited = EXCLUDED.invited, invite_time = EXCLUDED.invite_time
        `, [order_id]);

        // 返回带兼容字段的账单
        return await billModule.getBillByOrderId(order_id);
    } catch (error) {
        console.error('邀请好评数据库错误:', error);
        throw error;
    }
}

// 更新好评状态（写入 review_invitations）
async function updateReviewStatus(order_id, positive_review) {
    try {
        await query(`
            INSERT INTO review_invitations (order_id, invited, positive_review, update_time)
            VALUES ($1, TRUE, $2, NOW())
            ON CONFLICT (order_id)
            DO UPDATE SET positive_review = EXCLUDED.positive_review, update_time = EXCLUDED.update_time
        `, [order_id, positive_review]);

        return await billModule.getBillByOrderId(order_id);
    } catch (error) {
        console.error('更新好评状态数据库错误:', error);
        throw error;
    }
}

// 获取待邀请好评的账单（昨天和今天已入住且未邀请/未记录）
async function getPendingReviewInvitations() {
    try {
        const sqlQuery = `
            SELECT b.*, o.guest_name, o.phone, o.check_in_date,
                   COALESCE(ri.invited, FALSE) AS review_invited
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            LEFT JOIN review_invitations ri ON ri.order_id = b.order_id
            WHERE o.status = 'checked-in'
              AND COALESCE(ri.invited, FALSE) = FALSE
              AND o.check_in_date >= CURRENT_DATE - INTERVAL '1 day'
              AND o.check_in_date < CURRENT_DATE + INTERVAL '1 day'
            ORDER BY o.check_in_date DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取待邀请好评账单数据库错误:', error);
        throw error;
    }
}

// 获取已邀请但未设置好评状态的账单
async function getPendingReviewUpdates() {
    try {
        const sqlQuery = `
            SELECT b.*, o.guest_name, o.phone, o.check_out_date,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            JOIN review_invitations ri ON ri.order_id = b.order_id
            WHERE ri.invited = TRUE
              AND ri.positive_review IS NULL
            ORDER BY ri.invite_time DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取待更新好评状态账单数据库错误:', error);
        throw error;
    }
}

module.exports = {
    inviteReview,
    updateReviewStatus,
    getPendingReviewInvitations,
    getPendingReviewUpdates
};
