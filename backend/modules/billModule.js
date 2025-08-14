"use strict";

const { query } = require('../database/postgreDB/pg');

// 创建账单：初次创建 refund_time 为空，表示尚未发生押金退款
async function createBill(order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks) {
    // 计算 stay_date & 业务类型 (休息房 / 客房)
    let stayDate = null;
    let finalRemarks = remarks || '';
    try {
        const orderRes = await query(`SELECT room_price, check_in_date, check_out_date FROM orders WHERE order_id=$1`, [order_id]);
        if (orderRes.rows.length) {
            const o = orderRes.rows[0];
            // 计算 stay_date: room_price JSON 最早 key -> 否则用 check_in_date
            if (o.room_price && typeof o.room_price === 'object') {
                const keys = Object.keys(o.room_price || {}).sort();
                if (keys.length) stayDate = keys[0];
            }
            if (!stayDate) stayDate = o.check_in_date; // fallback

            // 业务类型判断: 同日入住退房 => 休息房, 否则客房
            if (o.check_in_date && o.check_out_date) {
                const inDay = new Date(o.check_in_date).toISOString().slice(0,10);
                const outDay = new Date(o.check_out_date).toISOString().slice(0,10);
                finalRemarks = (inDay === outDay) ? '休息房' : '客房';
            }
        }
    } catch (e) {
        console.warn('[createBill] 解析 stay_date / 业务类型失败, 使用默认备注. order_id=', order_id, e.message);
    }

    const sqlQuery = `
        INSERT INTO bills (
            order_id, room_number, guest_name, deposit, refund_deposit,
            room_fee, total_income, pay_way, create_time, refund_time, stay_date, remarks
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, NOW(), NULL, $9, $10
        )
        RETURNING *
    `;

    try {
        const result = await query(sqlQuery, [
            order_id,
            room_number,
            guest_name,
            deposit,
            refund_deposit,
            room_fee,
            total_income,
            pay_way,
            stayDate,
            finalRemarks
        ]);
        return result.rows[0];
    } catch (error) {
        console.error('创建账单数据库错误:', error);
        throw error;
    }
}

// 获得订单的“最新一条”账单（兼容旧接口 getBillByOrderId）
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
            ORDER BY b.create_time DESC
            LIMIT 1
        `;
        const result = await query(sqlQuery, [order_id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('获得账单数据库错误:', error);
        throw error;
    }
}

// 获得某订单的全部账单（按创建时间升序）
async function getBillsByOrderId(order_id){
    try {
        const sqlQuery = `
            SELECT b.*,
                   ri.invited AS review_invited,
                   ri.positive_review,
                   ri.invite_time AS review_invite_time,
                   ri.update_time AS review_update_time
            FROM bills b
            LEFT JOIN review_invitations ri ON ri.order_id = b.order_id
            WHERE b.order_id = $1
            ORDER BY b.create_time ASC
        `;
        const result = await query(sqlQuery, [order_id]);
        return result.rows;
    } catch (error) {
        console.error('获取订单全部账单数据库错误:', error);
        throw error;
    }
}

// 应用押金退款到对应账单（累积，refund_deposit 为负数，绝对值为已退金额）
async function applyDepositRefund(order_id, actualRefundAmount, refundMethod, refundTime){
    if (!order_id || !actualRefundAmount || actualRefundAmount <= 0) return null;
    try {
        // 找到含押金的第一张账单（通常押金只在第一张账单上）
        const billRes = await query(`SELECT * FROM bills WHERE order_id = $1 AND COALESCE(deposit,0) > 0 ORDER BY create_time ASC LIMIT 1`, [order_id]);
        if (billRes.rows.length === 0) {
            console.warn(`[applyDepositRefund] 未找到含押金账单, order_id=${order_id}`);
            return null;
        }
        const bill = billRes.rows[0];
        const currentRefund = parseFloat(bill.refund_deposit) || 0; // <=0
        const deposit = parseFloat(bill.deposit) || 0;
        const newRefund = currentRefund - actualRefundAmount; // 更负
        if (Math.abs(newRefund) - deposit > 0.00001) {
            throw new Error(`退款累计 (${Math.abs(newRefund)}) 不能超过押金 (${deposit})`);
        }
        let refundTimeValue = refundTime;
        // 仅在 bill.refund_time 为空时记录首次退款时间
        if (!bill.refund_time) {
            refundTimeValue = refundTime || new Date();
        } else {
            // 如果已有退款时间，保持原值
            refundTimeValue = bill.refund_time;
        }
        const updateRes = await query(`UPDATE bills SET refund_deposit=$1, refund_time=$2, refund_method=$3 WHERE bill_id=$4 RETURNING *`, [newRefund, refundTimeValue, refundMethod, bill.bill_id]);
        return updateRes.rows[0];
    } catch (error) {
        console.error('应用押金退款到账单失败:', error);
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
    getBillsByOrderId,
    getAllBills,
    applyDepositRefund
};
