"use strict";

const setup = require("../../appSettings/setup");
const { query } = require("../../database/postgreDB/pg");
const { formatDate } = require("../tools");

const CHANGE_TYPE_ROOM_FEE = setup.changeType?.roomFee || '房费';

async function getBillByOrderId(orderId) {
  const sql = `
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
  const result = await query(sql, [orderId]);
  return result.rows[0] || null;
}

async function getBillsByOrderId(orderId) {
  const sql = `
    SELECT b.*
    FROM bills b
    WHERE b.order_id = $1
    ORDER BY b.create_time ASC
  `;
  const result = await query(sql, [orderId]);
  return result.rows;
}

async function getAllBills() {
  const sql = `
    SELECT b.*,
           ri.invited AS review_invited,
           ri.positive_review,
           ri.invite_time AS review_invite_time,
           ri.update_time AS review_update_time
    FROM bills b
    LEFT JOIN review_invitations ri ON ri.order_id = b.order_id
    ORDER BY b.create_time DESC
  `;
  const result = await query(sql);
  return result.rows;
}

async function insertBill(billData, client) {
  const runner = client || query;
  const stayDate = formatDate(billData.stay_date) || null;
  const createTime = typeof billData.create_time === 'string' ? billData.create_time : null;
  const sql = `
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
    billData.change_price,
    billData.change_type,
    billData.pay_way,
    createTime,
    billData.remarks || null,
    billData.stay_type,
    stayDate
  ];
  const result = client ? await runner.query(sql, values) : await runner(sql, values);
  return result.rows[0];
}

async function insertDepositRefund(orderId, amount, refundMethod, refundTime) {
  const orderResult = await query(
    'SELECT room_number, guest_name FROM orders WHERE order_id=$1',
    [orderId]
  );
  if (!orderResult.rows.length) {
    throw new Error(`[applyDepositRefund] 订单不存在: ${orderId}`);
  }

  const { room_number: roomNumber, guest_name: guestName } = orderResult.rows[0];
  const sql = `
    INSERT INTO bills (order_id, room_number, guest_name, change_price, change_type, pay_way, stay_date, remarks)
    VALUES ($1, $2, $3, $4, '退押', $5, COALESCE($6::date, CURRENT_DATE), $7)
    RETURNING *
  `;
  const stayDate = refundTime ? formatDate(refundTime) : null;
  const result = await query(sql, [
    orderId,
    roomNumber,
    guestName,
    -Math.abs(Number(amount) || 0),
    refundMethod,
    stayDate,
    '退押'
  ]);
  return result.rows[0];
}

async function getOrderBillDetails(orderId) {
  const sql = `
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
  const result = await query(sql, [orderId]);
  return result.rows;
}

async function findBillById(billId) {
  const result = await query('SELECT * FROM bills WHERE bill_id = $1', [billId]);
  return result.rows[0] || null;
}

async function updateBillFields(billId, fields, values) {
  const sql = `
    UPDATE bills
    SET ${fields.join(', ')}
    WHERE bill_id = $${values.length + 1}
    RETURNING *
  `;
  const result = await query(sql, [...values, billId]);
  return result.rows[0];
}

async function insertOtherIncome(data) {
  const sql = `
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
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,($7::timestamptz)::date)
    RETURNING *
  `;
  const values = [
    null,
    null,
    data.guest_name || '其他收入',
    data.amount,
    data.income_type || '其他收入',
    data.pay_way,
    data.income_date,
    data.remarks || '',
    '租车收入'
  ];
  const result = await query(sql, values);
  return result.rows[0];
}

async function listBillsByDate(date) {
  const sql = `
    SELECT
      b.bill_id,
      b.order_id,
      b.stay_date,
      COALESCE(b.stay_type, o.stay_type) AS stay_type,
      b.change_price,
      b.change_type,
      b.pay_way,
      b.create_time,
      COALESCE(b.room_number, o.room_number) AS room_number,
      COALESCE(b.guest_name, o.guest_name) AS guest_name,
      o.phone,
      o.status as order_status
    FROM bills b
    LEFT JOIN LATERAL (
      SELECT
        ord.stay_type,
        ord.room_number,
        ord.guest_name,
        ord.phone,
        ord.status,
        ord.stay_date,
        ord.create_time
      FROM orders ord
      WHERE ord.order_id = b.order_id
      ORDER BY
        (ord.stay_date = b.stay_date) DESC,
        (ord.stay_date = DATE(b.create_time)) DESC,
        ord.stay_date DESC NULLS LAST,
        ord.create_time DESC NULLS LAST
      LIMIT 1
    ) o ON TRUE
    WHERE DATE(b.create_time) = $1::date
      AND COALESCE(b.pay_way, '') <> '平台'
    ORDER BY o.stay_type, b.order_id, b.bill_id ASC
  `;
  const result = await query(sql, [date]);
  return result.rows;
}

async function fetchAutoBillCandidateOrders(targetDate, statuses) {
  const sql = `
    SELECT
      order_id,
      room_number,
      guest_name,
      check_in_date,
      check_out_date,
      stay_date,
      status,
      payment_method,
      total_price,
      stay_type
    FROM orders
    WHERE check_in_date <= $1::date
      AND check_out_date > $1::date
      AND status = ANY($2::text[])
  `;
  const result = await query(sql, [targetDate, statuses]);
  return result.rows;
}

async function hasRoomFeeBillForDate(orderId, stayDate) {
  const sql = `
    SELECT bill_id
    FROM bills
    WHERE order_id = $1
      AND stay_date = $2::date
      AND change_type = $3
    LIMIT 1
  `;
  const result = await query(sql, [orderId, stayDate, CHANGE_TYPE_ROOM_FEE]);
  return result.rowCount > 0;
}

async function insertDailyRoomFeeBill(order, stayDate, amount, payWay, stayType) {
  const sql = `
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
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, NOW(), $7, $8, $9
    )
    RETURNING bill_id
  `;
  const roomNumber = order.room_number ? String(order.room_number).slice(0, 10) : null;
  const values = [
    order.order_id,
    roomNumber,
    order.guest_name,
    amount,
    CHANGE_TYPE_ROOM_FEE,
    payWay,
    `自动创建当日账单（${stayDate}）`,
    stayType,
    stayDate
  ];
  const result = await query(sql, values);
  return result.rows[0];
}

module.exports = {
  getBillByOrderId,
  getBillsByOrderId,
  getAllBills,
  insertBill,
  insertDepositRefund,
  getOrderBillDetails,
  findBillById,
  updateBillFields,
  insertOtherIncome,
  listBillsByDate,
  fetchAutoBillCandidateOrders,
  hasRoomFeeBillForDate,
  insertDailyRoomFeeBill
};
