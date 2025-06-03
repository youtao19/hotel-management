"use strict";

const { query } = require('../database/postgreDB/pg');

// 创建账单
async function createBill(order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks) {
    // 转换 refund_deposit 从字符串到布尔值
    const refund_deposit_bool = refund_deposit === 'yes' || refund_deposit === true;

    const sqlQuery = `INSERT INTO bills (order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, create_time, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) RETURNING *`;

    try {
        const result = await query(sqlQuery, [order_id, room_number, guest_name, deposit, refund_deposit_bool, room_fee, total_income, pay_way, remarks]);
        return result.rows[0];
    } catch (error) {
        console.error('创建账单数据库错误:', error);
        throw error;
    }
}

module.exports = { createBill };
