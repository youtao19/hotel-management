"use strict";

const { query } = require('../database/postgreDB/pg');
const { toAmountNumber, formatDate } = require('./tools');
const REFUND_TYPES = new Set(['退押', '退押金', '退款']);

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
            INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, stay_date, remarks)
            VALUES ($1, $2, $3, $4, '退押', $5, COALESCE($6::date, CURRENT_DATE), $7)
            RETURNING *
        `;
        const stayDate = refundTime ? formatDate(refundTime) : null;
        const remarks = '退押';
        const result = await query(insertSql, [
            order_id,
            room_number,
            guest_name,
            -Math.abs(Number(actualRefundAmount) || 0),
            refundMethod,
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

/**
 * 添加账单记录
 * @param {Object} billData
 * @param {*} client
 * @returns
 */
async function addBill(billData, client){
  try {
    const runner = client || query;

    // 优先使用传入的 stay_date（DATE 字段按字符串处理）
    let stayDate = formatDate(billData.stay_date);
    if (!stayDate) stayDate = null;

    const createTime = typeof billData.create_time === 'string' ? billData.create_time : null;

    const insertQuery = `
        INSERT INTO bills (
            order_id,
            room_number,
            guest_name,
            change_price,
            change_type,
            pay_way,
            create_time,
            remarks,
            stay_type,
            stay_date
        ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, now()),$8,$9,COALESCE($10::date, (COALESCE($7::timestamptz, now()))::date))
        RETURNING *
    `;

    const values = [
      billData.order_id,
      billData.room_number || null,
      billData.guest_name,
      toAmountNumber(billData.change_price),
      billData.change_type,
      billData.pay_way,
      createTime,
      billData.remarks || null,
      billData.stay_type,
      stayDate
    ];

    // 退款和退押必须为负数，补收与收押必须为正数
    if (billData.change_type === '退款' || billData.change_type === '退押') {
      values[3] = -Math.abs(values[3]);
    } else if (billData.change_type === '补收' || billData.change_type === '收押') {
      values[3] = Math.abs(values[3]);
    }

    let result;
    if (!client) {
      result = await runner(insertQuery, values);
    } else {
      result = await client.query(insertQuery, values);
    }
    return result.rows[0];
  } catch (error) {
    console.error('添加账单失败:', error);
    throw error;
  }
}




// 获取订单的账单详情（按日期分组，聚合房费和押金）
async function getOrderBillDetails(order_id) {
    try {
        // 查询所有类型的账单记录（新格式）
        const sqlQuery = `
            SELECT
                stay_date,
                change_price,
                change_type,
                pay_way,
                create_time,
                remarks
            FROM bills
            WHERE order_id = $1
              AND change_type IN ('房费', '收押', '订单账单')
            ORDER BY stay_date ASC, create_time ASC
        `;
        const result = await query(sqlQuery, [order_id]);

        // 按日期分组，聚合房费和押金
        const dateMap = new Map();

        for (const row of result.rows) {
            const dateKey = formatDate(row.stay_date);

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, {
                    stay_date: dateKey,
                    room_fee: 0,
                    deposit: 0,
                    change_price: 0,
                    change_type: '订单账单',
                    pay_way: row.pay_way,
                    create_time: row.create_time,
                    remarks: row.remarks
                });
            }

            const dateData = dateMap.get(dateKey);

            // 根据 change_type 累加对应金额
            if (row.change_type === '房费') {
                dateData.room_fee += Number(row.change_price || 0);
            } else if (row.change_type === '收押') {
                dateData.deposit += Number(row.change_price || 0);
            } else if (row.change_type === '订单账单') {
                // 兼容旧格式的 '订单账单' 类型
                dateData.room_fee += Number(row.change_price || 0);
            }
        }

        // 转换为数组并返回
        return Array.from(dateMap.values());
    } catch (error) {
        console.error('获取订单账单详情数据库错误:', error);
        throw error;
    }
}

// 更新账单
async function updateBill(billId, updateData) {
    try {
        // 1. 先获取原始账单数据
        const originalResult = await query('SELECT * FROM bills WHERE bill_id = $1', [billId]);

        if (originalResult.rows.length === 0) {
            throw new Error(`账单 ${billId} 不存在`);
        }

        const originalBill = originalResult.rows[0];

        // 1.1 根据类型规范金额符号
        const nextChangeType = Object.prototype.hasOwnProperty.call(updateData, 'change_type')
            ? updateData.change_type
            : originalBill.change_type;

        if (REFUND_TYPES.has(nextChangeType)) {
            const priceSource = Object.prototype.hasOwnProperty.call(updateData, 'change_price')
                ? updateData.change_price
                : originalBill.change_price;
            const normalizedPrice = -Math.abs(Number(priceSource) || 0);
            if (!Object.prototype.hasOwnProperty.call(updateData, 'change_price') || normalizedPrice !== priceSource) {
                updateData = {
                    ...updateData,
                    change_price: normalizedPrice
                };
            }
        } else if (Object.prototype.hasOwnProperty.call(updateData, 'change_price')) {
            const parsed = Number(updateData.change_price);
            updateData.change_price = Number.isNaN(parsed) ? 0 : parsed;
        }

        // 2. 对比数据，构建需要更新的字段
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        let hasChanges = false;

        // 可更新的字段（移除了 room_fee, deposit, refund_deposit, total_income）
        const allowedFields = ['change_price', 'change_type', 'pay_way', 'remarks'];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined && updateData[field] !== originalBill[field]) {
                // 只有当值真正改变时才添加到更新列表
                updateFields.push(`${field} = $${paramIndex}`);
                values.push(updateData[field]);
                paramIndex++;
                hasChanges = true;

                console.log(`📝 [updateBill] 字段 ${field} 从 ${originalBill[field]} 更新为 ${updateData[field]}`);
            }
        });

        // 3. 如果没有变化，直接返回原始数据
        if (!hasChanges || updateFields.length === 0) {
            console.log(`ℹ️ [updateBill] 账单 ${billId} 没有变化，返回原始数据`);
            return originalBill;
        }

        // 4. 执行更新
        const updateQuery = `
            UPDATE bills
            SET ${updateFields.join(', ')}
            WHERE bill_id = $${paramIndex}
            RETURNING *
        `;
        values.push(billId);

        const result = await query(updateQuery, values);

        console.log(`✅ [updateBill] 账单 ${billId} 更新成功`);
        return result.rows[0];
    } catch (error) {
        console.error('更新账单失败:', error);
        throw error;
    }
}

module.exports = {
    getBillByOrderId,
    getBillsByOrderId,
    getAllBills,
    applyDepositRefund,
    addBill,
    getOrderBillDetails,
    updateBill,
};
