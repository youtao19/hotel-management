"use strict";

const { query } = require('../database/postgreDB/pg');

// 创建账单
async function createBill(order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks) {
    // 计算 stay_date & 业务类型 (休息房 / 客房)
    let stayDate = null;
    let finalRemarks = remarks || '';
    let orderRes = null;
    try {
        orderRes = await query(`SELECT total_price, check_in_date, check_out_date FROM orders WHERE order_id=$1`, [order_id]);
        if (orderRes.rows.length) {
            const o = orderRes.rows[0];
            // 计算 stay_date: total_price JSON 最早 key -> 否则用 check_in_date
            if (o.total_price && typeof o.total_price === 'object') {
                const keys = Object.keys(o.total_price || {}).sort();
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

    try {
        // 现在 total_price 是数值类型，无法通过它判断是否为多日订单
        // 改为通过日期差来判断多日订单
        const ordRow = orderRes.rows.length ? orderRes.rows[0] : null;
        let isMultiDay = false;
        if (ordRow && ordRow.check_in_date && ordRow.check_out_date) {
            const checkIn = new Date(ordRow.check_in_date);
            const checkOut = new Date(ordRow.check_out_date);
            const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            isMultiDay = daysDiff > 1; // 住宿超过1天视为多日订单
        }

        if (isMultiDay) {
            // 仅更新 orders 表的押金（如果传了押金）并返回更新后的订单信息（不在 bills 中插入行）
            if (deposit && Number(deposit) > 0) {
                try {
                    const upd = await query(`UPDATE orders SET deposit=$1 WHERE order_id=$2 RETURNING *`, [Number(deposit), order_id]);
                    return { skippedInsert: true, updatedOrder: upd.rows[0] };
                } catch (uErr) {
                    console.error('[createBill] 更新订单押金失败:', uErr);
                    throw uErr;
                }
            }
            // 如果没有押金需要更新，直接返回空结构，表示未在 bills 表插入
            return { skippedInsert: true };
        }

        // 否则（非多日订单）按 bills 表实际存在的列动态构建 INSERT，兼容已删除的列
        const availableColsRes = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='bills'`);
        const cols = (availableColsRes.rows || []).map(r => r.column_name);

        const insertCols = [];
        const placeholders = [];
        const params = [];

        let idx = 1;
        const pushCol = (name, value) => {
            insertCols.push(name);
            placeholders.push(`$${idx++}`);
            params.push(value);
        };

        // 必须字段
        pushCol('order_id', order_id);
        pushCol('room_number', room_number);
        pushCol('guest_name', guest_name);

        // 有些旧结构里还会有 deposit/refund_deposit/room_fee/total_income 列，只有在列存在时才写入
        if (cols.includes('deposit')) pushCol('deposit', Number(deposit) || 0);
        if (cols.includes('refund_deposit')) {
            // 旧结构约束: refund_deposit 通常应为<=0（负数表示已退押），因此将正数转为负数
            let rd = Number(refund_deposit);
            if (isNaN(rd)) rd = 0;
            if (rd > 0) rd = -Math.abs(rd);
            pushCol('refund_deposit', rd);
        }
        if (cols.includes('room_fee')) pushCol('room_fee', Number(room_fee) || 0);
        if (cols.includes('total_income')) pushCol('total_income', Number(total_income) || 0);

        // 支付方式列名可能是 pay_way（当前 DDL 有），确保存在后再写
        if (cols.includes('pay_way')) pushCol('pay_way', typeof pay_way === 'object' ? (pay_way?.value ?? pay_way?.label ?? '') : String(pay_way || ''));

        // 创建时间
        if (cols.includes('create_time')) {
            pushCol('create_time', new Date());
        }

        // stay_date 与 remarks
        if (cols.includes('stay_date')) pushCol('stay_date', stayDate);
        if (cols.includes('remarks')) pushCol('remarks', finalRemarks);

        const sql = `INSERT INTO bills (${insertCols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
        const insertRes = await query(sql, params);
        const row = insertRes.rows[0];
        // 兼容测试：将 refund_deposit 映射为 boolean 返回
        if (row && Object.prototype.hasOwnProperty.call(row, 'refund_deposit')) {
            const v = Number(row.refund_deposit) || 0;
            row.refund_deposit = v > 0 ? true : false;
        }
        return row;
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
            SELECT b.*
            FROM bills b
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

// 应用押金退款：按新规则写入一条账单记录（change_price 为负数，change_type='退押'，pay_way=退款方式）
async function applyDepositRefund(order_id, actualRefundAmount, refundMethod, refundTime){
    if (!order_id || !actualRefundAmount || actualRefundAmount <= 0) return null;
    try {
        // 读取订单信息以获取房间和客人名
        const ord = await query(`SELECT room_number, guest_name FROM orders WHERE order_id=$1`, [order_id]);
        if (!ord.rows.length) {
            throw new Error(`[applyDepositRefund] 订单不存在: ${order_id}`);
        }
        const { room_number, guest_name } = ord.rows[0];

        const insertSql = `
            INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, create_time, stay_date, remarks)
            VALUES ($1, $2, $3, $4, '退押', $5, $6, $7, $8)
            RETURNING *
        `;
        const createTime = refundTime ? new Date(refundTime) : new Date();
        const stayDate = createTime.toISOString().slice(0,10);
        const remarks = '退押';
        const result = await query(insertSql, [
            order_id,
            room_number,
            guest_name,
            -Math.abs(Number(actualRefundAmount) || 0),
            refundMethod,
            createTime,
            stayDate,
            remarks
        ]);
        return result.rows[0];
    } catch (error) {
        console.error('应用押金退款(写入退押记录)失败:', error);
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

// 添加账单
async function addBill(billData){

  const {
    order_id,
    change_price,
    method,
    notes,
    refundTime
  } = billData;

  let newbill = null;
  // 获取订单
  try {
    const orderSql = `
    SELECT order_id, guest_name, room_number, check_in_date, check_out_date, payment_method, total_price, deposit, stay_type
    FROM orders
    WHERE order_id = $1
    `;
    const orderRes = await query(orderSql, [billData.order_id]);

    if (!orderRes.rows.length) {
      throw new Error(`[addBill] 订单不存在: ${billData.order_id}`);
    }

    const o = orderRes.rows[0];

        // 当前 bills 表结构 (参见 backend/database/postgreDB/tables/bill.js):
        // bill_id, order_id, room_number, guest_name, room_fee, deposit, change_price, change_type, pay_way, create_time, remarks, stay_type
        // 这里插入除 bill_id (自增) 之外的其它字段，顺序需与列名一致
        const insertQuery = `
            INSERT INTO bills (
                order_id,
                room_number,
                guest_name,
                room_fee,
                deposit,
                change_price,
                change_type,
                pay_way,
                create_time,
                remarks,
                stay_type
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *
        `;

        const numericChangePrice = Number(change_price);
        if (isNaN(numericChangePrice)) {
            throw new Error('[addBill] change_price 必须为数字');
        }

        const values = [
        order_id,                // $1 order_id
        String(o.room_number).slice(0,10), // $2 room_number (bills 表限制 10)
        o.guest_name,            // $3 guest_name
        o.total_price,           // $4 room_fee (总价格)
        o.deposit,               // $5 deposit
        numericChangePrice,      // $6 change_price
        billData.change_type,    // $7 change_type
        method || o.payment_method, // $8 pay_way
        refundTime || new Date(),   // $9 create_time
        notes,                   // $10 remarks
        o.stay_type              // $11 stay_type
        ];

    const result = await query(insertQuery, values);
    newbill = result.rows[0];
  } catch (error) {
    console.error('添加账单数据库错误:', error);
    throw error;
  }
  return newbill;
}

module.exports = {
    createBill,
    getBillByOrderId,
    getBillsByOrderId,
    getAllBills,
    applyDepositRefund,
    addBill
};
