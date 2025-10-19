"use strict";

const { query } = require('../database/postgreDB/pg');

const REFUND_TYPES = new Set(['退押', '退押金', '退款']);

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

// 添加账单（新版本：使用 change_price + change_type）
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

        // 新版表结构：使用 change_price 和 change_type 统一管理所有金额
        // change_type 可选值：房费、收押、退押、补收、退款
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
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *
        `;

        const numericChangePrice = Number(change_price);
        if (isNaN(numericChangePrice)) {
            throw new Error('[addBill] change_price 必须为数字');
        }

        // 处理日期字段，确保正确格式
        const createTimeDate = refundTime ? (typeof refundTime === 'string' ? new Date(refundTime) : refundTime) : new Date();
        const stayDateString = createTimeDate.toISOString().split('T')[0];

        const values = [
        order_id,                // $1 order_id
        String(o.room_number).slice(0,10), // $2 room_number (bills 表限制 10)
        o.guest_name,            // $3 guest_name
        numericChangePrice,      // $4 change_price (正数表示收入，负数表示支出)
        billData.change_type,    // $5 change_type (房费/收押/退押/补收/退款)
        method || o.payment_method, // $6 pay_way
        createTimeDate,          // $7 create_time
        notes,                   // $8 remarks
        o.stay_type,             // $9 stay_type
        stayDateString           // $10 stay_date
        ];

    const result = await query(insertQuery, values);
    newbill = result.rows[0];
  } catch (error) {
    console.error('添加账单数据库错误:', error);
    throw error;
  }
  return newbill;
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
            const dateKey = row.stay_date.toISOString ? row.stay_date.toISOString().split('T')[0] : row.stay_date;

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, {
                    stay_date: row.stay_date,
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

// 更新账单（新版本：使用 change_price + change_type）
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

// 根据订单号、日期和类型更新账单（新版本：需要指定 change_type）
async function updateBillByOrderAndDate(orderNumber, stayDate, updateData) {
    try {
        const normalizedData = { ...updateData };
        const explicitPriceProvided = Object.prototype.hasOwnProperty.call(normalizedData, 'change_price');

        if (explicitPriceProvided) {
            const parsed = Number(normalizedData.change_price);
            normalizedData.change_price = Number.isNaN(parsed) ? 0 : parsed;
        }

        const effectiveType = Object.prototype.hasOwnProperty.call(normalizedData, 'change_type')
            ? normalizedData.change_type
            : normalizedData.target_change_type;

        const shouldForceNegative = REFUND_TYPES.has(effectiveType || '');

        if (shouldForceNegative && explicitPriceProvided) {
            normalizedData.change_price = -Math.abs(Number(normalizedData.change_price) || 0);
        }

        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        // 可更新的字段（移除了 room_fee, deposit, refund_deposit, total_income）
        const allowedFields = ['change_price', 'change_type', 'pay_way', 'remarks'];

        allowedFields.forEach(field => {
            if (normalizedData[field] !== undefined) {
                updateFields.push(`${field} = $${paramIndex}`);
                values.push(normalizedData[field]);
                paramIndex++;
            }
        });

        if (shouldForceNegative && !explicitPriceProvided) {
            updateFields.push('change_price = -ABS(change_price)');
        }

        if (updateFields.length === 0) {
            throw new Error('没有要更新的字段');
        }

        // 如果指定了 change_type，则根据类型更新特定的账单
        // 否则更新该日期的所有账单（兼容旧接口）
        let whereClause = `order_id = $${paramIndex} AND DATE(stay_date) = DATE($${paramIndex + 1})`;
        values.push(orderNumber, stayDate);

        if (normalizedData.target_change_type) {
            // 如果指定了目标类型，则只更新该类型的账单
            whereClause += ` AND change_type = $${paramIndex + 2}`;
            values.push(normalizedData.target_change_type);
        }

        const updateQuery = `
            UPDATE bills
            SET ${updateFields.join(', ')}
            WHERE ${whereClause}
            RETURNING *
        `;

        const result = await query(updateQuery, values);

        if (result.rows.length === 0) {
            console.warn(`未找到订单 ${orderNumber} 日期 ${stayDate} 的账单记录`);
            return null;
        }

        return result.rows;
    } catch (error) {
        console.error('根据订单号和日期更新账单失败:', error);
        throw error;
    }
}

module.exports = {
    createBill,
    getBillByOrderId,
    getBillsByOrderId,
    getAllBills,
    applyDepositRefund,
    addBill,
    getOrderBillDetails,
    updateBill,
    updateBillByOrderAndDate
};
