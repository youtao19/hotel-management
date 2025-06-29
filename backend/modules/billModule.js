"use strict";

const { query } = require('../database/postgreDB/pg');

// 创建账单
async function createBill(order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks) {

    const sqlQuery = `INSERT INTO bills (order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, create_time, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) RETURNING *`;

    try {
        const result = await query(sqlQuery, [order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way , remarks]);
        return result.rows[0];
    } catch (error) {
        console.error('创建账单数据库错误:', error);
        throw error;
    }
}

// 获得账单
async function getBillByOrderId(order_id){
    try {
        const sqlQuery = `SELECT * FROM bills WHERE order_id = $1`;
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0];
    } catch (error) {
        console.error('获得账单数据库错误:', error);
        throw error;
    }
}

// 邀请客户好评
async function inviteReview(order_id) {
    const sqlQuery = `UPDATE bills SET review_invited = TRUE, review_invite_time = NOW() WHERE order_id = $1 RETURNING *`;

    try {
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0];
    } catch (error) {
        console.error('邀请好评数据库错误:', error);
        throw error;
    }
}

// 更新好评状态
async function updateReviewStatus(order_id, positive_review) {
    const sqlQuery = `UPDATE bills SET positive_review = $1, review_update_time = NOW() WHERE order_id = $2 RETURNING *`;

    try {
        const result = await query(sqlQuery, [positive_review, order_id]);
        return result.rows[0];
    } catch (error) {
        console.error('更新好评状态数据库错误:', error);
        throw error;
    }
}

// 获取所有账单（包含好评信息）
async function getAllBills() {
    try {
        const sqlQuery = `SELECT * FROM bills ORDER BY create_time DESC`;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取所有账单数据库错误:', error);
        throw error;
    }
}

// 获取待邀请好评的账单（退房后未邀请好评的）
async function getPendingReviewInvitations() {
    try {
        const sqlQuery = `
            SELECT b.*, o.guest_name, o.phone, o.check_out_date
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            WHERE o.status = 'checked-out'
            AND b.review_invited = FALSE
            ORDER BY b.create_time DESC
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
            SELECT b.*, o.guest_name, o.phone, o.check_out_date
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            WHERE b.review_invited = TRUE
            AND b.positive_review IS NULL
            ORDER BY b.review_invite_time DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取待更新好评状态账单数据库错误:', error);
        throw error;
    }
}

module.exports = {
    createBill,
    getBillByOrderId,
    inviteReview,
    updateReviewStatus,
    getAllBills,
    getPendingReviewInvitations,
    getPendingReviewUpdates
};
