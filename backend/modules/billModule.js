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

module.exports = { createBill, getBillByOrderId };
