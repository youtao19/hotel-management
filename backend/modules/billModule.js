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

// 获得账单（兼容返回好评字段）
async function getBillByOrderId(order_id){
    try {
        const sqlQuery = `
            SELECT b.*,
                   ri.invited AS review_invited,
                   ri.positive_review AS positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM bills b
            LEFT JOIN review_invitations ri ON ri.order_id = b.order_id
            WHERE b.order_id = $1
        `;
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0];
    } catch (error) {
        console.error('获得账单数据库错误:', error);
        throw error;
    }
}



// 获取所有账单（包含好评信息）
async function getAllBills() {
    try {
        const sqlQuery = `
            SELECT b.*,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM bills b
            LEFT JOIN review_invitations ri ON ri.order_id = b.order_id
            ORDER BY b.create_time DESC
        `;
        const result = await query(sqlQuery);
        return result.rows;
    } catch (error) {
        console.error('获取所有账单数据库错误:', error);
        throw error;
    }
}



module.exports = {
    createBill,
    getBillByOrderId,
    getAllBills
};
