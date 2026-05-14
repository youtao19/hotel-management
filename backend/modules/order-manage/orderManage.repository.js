const { query, getClient } = require('../../database/postgreDB/pg');
const { toAmountNumber } = require('../tools');

const DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 兼容旧启动检查：确认 orders 表是否已经初始化。
 */
async function checkOrderTableExists() {
  return query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'orders'
    );
  `);
}

/**
 * 查询订单列表页的聚合订单数据。
 * 多日订单先按 order_id 聚合，再对聚合后的展示字段做搜索和筛选。
 */
async function listOrders(filters = {}) {
  const normalizedFilters = (filters && typeof filters === 'object') ? filters : {};
  const rawSearch = String(normalizedFilters.search || '').trim();
  const rawStatus = String(normalizedFilters.status || '').trim();
  const rawDate = String(normalizedFilters.date || '').trim();

  const searchLike = rawSearch ? `%${rawSearch}%` : null;
  const statusFilter = rawStatus || null;
  const dateFilter = DATE_FILTER_REGEX.test(rawDate) ? rawDate : null;

  const result = await query(`
    WITH aggregated_orders AS (
      SELECT
        order_id,
        MAX(id_source) as id_source,
        MAX(order_source) as order_source,
        MAX(guest_name) as guest_name,
        MAX(phone) as phone,
        MAX(room_type) as room_type,
        MAX(room_number) as room_number,
        MIN(check_in_date) as check_in_date,
        MAX(check_out_date) as check_out_date,
        MAX(status) as status,
        MAX(payment_method) as payment_method,
        SUM(total_price) as total_price,
        SUM(deposit) as deposit,
        MAX(COALESCE(deposit, 0)) as deposit_for_refund,
        BOOL_OR(is_prepaid) as is_prepaid,
        SUM(prepaid_amount) as prepaid_amount,
        GREATEST(SUM(total_price) - SUM(prepaid_amount), 0) as remaining_room_fee,
        MIN(create_time) as create_time,
        MAX(stay_type) as stay_type,
        MAX(remarks) as remarks,
        COUNT(*) as stay_days,
        (MIN(check_in_date) = MAX(check_out_date)) as is_rest_room,
        ARRAY_AGG(stay_date ORDER BY stay_date) as stay_dates,
        JSONB_OBJECT_AGG(stay_date::text, total_price) as daily_prices
      FROM orders
      GROUP BY order_id
    ),
    refund_summary AS (
      SELECT
        b.order_id,
        ROUND(
          COALESCE(
            SUM(
              CASE
                WHEN b.change_type = '退押' THEN ABS(LEAST(COALESCE(b.change_price, 0), 0))
                ELSE 0
              END
            ),
            0
          )::numeric,
          2
        ) AS refunded_deposit
      FROM bills b
      GROUP BY b.order_id
    )
    SELECT
      ao.*,
      COALESCE(rs.refunded_deposit, 0)::numeric AS refunded_deposit,
      GREATEST(COALESCE(ao.deposit_for_refund, 0) - COALESCE(rs.refunded_deposit, 0), 0)::numeric AS remaining_deposit,
      CASE
        WHEN ao.status IN ('checked-out', 'cancelled')
          AND GREATEST(COALESCE(ao.deposit_for_refund, 0) - COALESCE(rs.refunded_deposit, 0), 0) > 0
        THEN TRUE
        ELSE FALSE
      END AS can_refund_deposit
    FROM aggregated_orders ao
    LEFT JOIN refund_summary rs ON rs.order_id = ao.order_id
    WHERE ($1::text IS NULL OR (
        ao.order_id ILIKE $1
        OR COALESCE(ao.guest_name, '') ILIKE $1
        OR COALESCE(ao.phone, '') ILIKE $1
        OR COALESCE(ao.room_number, '') ILIKE $1
      ))
      AND ($2::text IS NULL OR ao.status = $2)
      AND ($3::date IS NULL OR ao.check_in_date = $3::date OR ao.check_out_date = $3::date)
    ORDER BY ao.create_time DESC
  `, [searchLike, statusFilter, dateFilter]);

  return result.rows;
}

/**
 * 查询每日房间安排页的订单明细。
 * 返回 orders 原始日记录，保留多日订单“一天一行”的展示口径。
 */
async function listDailyOrders() {
  const result = await query('SELECT * FROM orders ORDER BY order_id, stay_date');
  return result.rows;
}

/**
 * 查询一笔订单的所有日记录。
 * 多日订单保持数组响应；没有记录时返回 null，兼容旧详情接口。
 */
async function findOrderRowsByOrderId(orderId) {
  const result = await query('SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date', [orderId]);
  return result.rows.length > 0 ? result.rows : null;
}

/**
 * 查询单条订单日记录，供旧兼容出口和少量内部工具使用。
 */
async function findOrderRowById(id) {
  const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * 修改同一订单号下所有日记录的状态。
 * 多日订单共用 order_id，状态变更必须一次覆盖全部日记录。
 */
async function updateOrderStatus(orderId, newStatus) {
  const result = await query(
    'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
    [newStatus, orderId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 读取订单编辑前的每日记录。
 * 基础编辑会覆盖同一 order_id 下所有日记录，需要先拿第一行做变更对比。
 */
async function findOrderRowsForUpdate(runner, orderNumber) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
    [orderNumber]
  );
  return result.rows;
}

/**
 * 更新订单基础字段。
 * 字段名只来自 service 白名单，避免把前端任意字段拼进 SQL。
 */
async function updateOrderFields(runner, orderNumber, fields) {
  const entries = Object.entries(fields);
  const assignments = entries.map(([field], index) => `${field} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(orderNumber);

  const result = await runner.query(`
    UPDATE orders
       SET ${assignments.join(', ')}
     WHERE order_id = $${values.length}
     RETURNING *
  `, values);
  return result.rows;
}

/**
 * 基础编辑改支付方式时，同步未拆分房费账单的收款方式。
 * 复杂混合支付仍由 with-bills 流程处理。
 */
async function updateRoomFeeBillsPaymentMethod(runner, orderNumber, paymentMethod) {
  return runner.query(`
    UPDATE bills
       SET pay_way = $1
     WHERE order_id = $2
       AND change_type = '房费'
  `, [paymentMethod, orderNumber]);
}

/**
 * 锁定联合编辑涉及的订单日记录。
 * with-bills 会同时改订单、房费和押金账单，必须串行处理同一订单。
 */
async function findOrderRowsForUpdateWithBills(runner, orderNumber) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date FOR UPDATE',
    [orderNumber]
  );
  return result.rows;
}

async function updateDailyRoomPrice(runner, orderNumber, stayDate, price) {
  const orderResult = await runner.query(`
    UPDATE orders
       SET total_price = $1
     WHERE order_id = $2
       AND stay_date = $3::date
  `, [price, orderNumber, stayDate]);

  const billResult = await runner.query(`
    UPDATE bills
       SET change_price = $1
     WHERE order_id = $2
       AND change_type = '房费'
       AND stay_date = $3::date
  `, [price, orderNumber, stayDate]);

  return {
    orderUpdated: orderResult.rowCount,
    billUpdated: billResult.rowCount
  };
}

async function findOrderRowsInTransaction(runner, orderNumber) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
    [orderNumber]
  );
  return result.rows;
}

async function findBillsForSplitUpdate(runner, orderNumber, changeType, stayDate) {
  const values = [orderNumber, changeType];
  let stayDateFilter = '';
  if (stayDate !== undefined) {
    values.push(stayDate);
    stayDateFilter = `AND stay_date = $${values.length}::date`;
  }

  const result = await runner.query(`
    SELECT bill_id
      FROM bills
     WHERE order_id = $1
       AND change_type = $2
       ${stayDateFilter}
     ORDER BY bill_id ASC
     FOR UPDATE
  `, values);
  return result.rows;
}

async function updateSplitBill(runner, billId, billData) {
  const {
    amount,
    payWay,
    roomNumber,
    guestName,
    stayType,
    remarks,
    stayDate
  } = billData;

  return runner.query(`
    UPDATE bills
       SET change_price = $1,
           pay_way = $2,
           room_number = $3,
           guest_name = $4,
           stay_type = $5,
           remarks = $6,
           stay_date = $7::date
     WHERE bill_id = $8
  `, [amount, payWay, roomNumber, guestName, stayType, remarks, stayDate, billId]);
}

async function insertBillInTransaction(runner, billData) {
  const {
    orderNumber,
    roomNumber,
    guestName,
    amount,
    changeType,
    payWay,
    remarks,
    stayType,
    stayDate
  } = billData;

  const result = await runner.query(`
    INSERT INTO bills (
      order_id, room_number, guest_name, change_price, change_type,
      pay_way, remarks, stay_type, stay_date
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date)
    RETURNING *
  `, [
    orderNumber,
    roomNumber,
    guestName,
    amount,
    changeType,
    payWay,
    remarks,
    stayType,
    stayDate
  ]);
  return result.rows[0] || null;
}

async function deleteBillsByIds(runner, billIds) {
  return runner.query(
    'DELETE FROM bills WHERE bill_id = ANY($1::int[])',
    [billIds]
  );
}

async function updateOrderPaymentMethodInTransaction(runner, orderNumber, paymentMethod) {
  return runner.query(
    'UPDATE orders SET payment_method = $1 WHERE order_id = $2',
    [paymentMethod, orderNumber]
  );
}

async function updateAllBillRoomNumbers(runner, orderNumber, roomNumber) {
  return runner.query(
    'UPDATE bills SET room_number = $1 WHERE order_id = $2',
    [roomNumber, orderNumber]
  );
}

async function countRoomFeeBillPaymentWays(runner, orderNumber) {
  const result = await runner.query(`
    SELECT COUNT(DISTINCT pay_way) AS payway_count
      FROM bills
     WHERE order_id = $1
       AND change_type = '房费'
  `, [orderNumber]);
  return Number(result.rows[0]?.payway_count || 0);
}

/**
 * 在外层退房事务中修改订单状态。
 * 退房需要和房态更新同进同退，不能使用独立 query 连接。
 */
async function updateOrderStatusInTransaction(runner, orderId, newStatus) {
  const result = await runner.query(
    'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
    [newStatus, orderId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 读取退房订单的所有日记录。
 * 正常退房要按订单日记录覆盖涉及的房间状态。
 */
async function findOrderRowsForCheckout(runner, orderId) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
    [orderId]
  );
  return result.rows;
}

/**
 * 将订单涉及的房间设为清洁中。
 * 多日同房会重复命中同一房间，SQL 本身保持幂等。
 */
async function markRoomCleaning(runner, roomNumber) {
  return runner.query(
    'UPDATE rooms SET status = $1 WHERE room_number = $2',
    ['cleaning', roomNumber]
  );
}

/**
 * 锁定提前退房订单的所有日记录。
 * 提前退房会改订单行、删未住日期和写退款账单，必须防止并发编辑同一订单。
 */
async function findOrderRowsForEarlyCheckout(runner, orderNumber) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date FOR UPDATE',
    [orderNumber]
  );
  return result.rows;
}

/**
 * 统计订单当前账单净收款。
 * 未入住退房没有手填退款金额时，用它兜底计算可退金额。
 */
async function getOrderBillNetPaid(runner, orderNumber) {
  const { rows } = await runner.query(
    'SELECT COALESCE(SUM(change_price), 0) AS net_paid FROM bills WHERE order_id = $1',
    [orderNumber]
  );
  return Number(rows[0]?.net_paid || 0);
}

/**
 * 未入住退房会取消整单并清零房费。
 * 这不是正常退房，后续可通过 cancelled 状态区分。
 */
async function cancelOrderAfterCheckin(runner, orderNumber, actualCheckoutDate) {
  return runner.query(`
    UPDATE orders
       SET check_out_date = $1,
           status = 'cancelled',
           total_price = 0
     WHERE order_id = $2
  `, [actualCheckoutDate, orderNumber]);
}

/**
 * 已入住提前退房会保留已住日期，并把剩余日期从订单明细中删除。
 */
async function updateOrderEarlyCheckout(runner, orderNumber, actualCheckoutDate) {
  return runner.query(`
    UPDATE orders
       SET check_out_date = $1,
           status = 'checked-out'
     WHERE order_id = $2
  `, [actualCheckoutDate, orderNumber]);
}

async function deleteUnstayedOrderRows(runner, orderNumber, actualCheckoutDate) {
  return runner.query(`
    DELETE FROM orders
     WHERE order_id = $1
       AND stay_date >= $2
  `, [orderNumber, actualCheckoutDate]);
}

/**
 * 写提前退房退款账单。
 * changeType 由业务分支传入，保持旧口径：未入住为“退款”，已入住为“房费”负数。
 */
async function insertEarlyCheckoutRefundBill(runner, billData) {
  const {
    orderNumber,
    roomNumber,
    guestName,
    amount,
    changeType,
    payWay,
    remarks,
    stayType,
    stayDate
  } = billData;

  const result = await runner.query(`
    INSERT INTO bills (
      order_id, room_number, guest_name, change_price, change_type,
      pay_way, remarks, stay_type, stay_date
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [
    orderNumber,
    roomNumber,
    guestName,
    amount,
    changeType,
    payWay,
    remarks,
    stayType,
    stayDate
  ]);
  return result.rows[0] || null;
}

async function markRoomAvailable(runner, roomNumber) {
  return runner.query(
    'UPDATE rooms SET status = $1 WHERE room_number = $2',
    ['available', roomNumber]
  );
}

/**
 * 记录提前退房变更。
 * 变更记录失败不影响主流程，所以由 service 在主事务提交后单独调用。
 */
async function insertOrderChangeLog(orderNumber, changedBy, changes, reason) {
  return query(
    `INSERT INTO order_changes
      (order_id, changed_by, changes, reason)
     VALUES ($1, $2, $3, $4)`,
    [orderNumber, changedBy, JSON.stringify(changes), reason]
  );
}

/**
 * 查询订单某一天的日记录。
 * 每日换房只改指定 stayDate，不能影响同订单的其他住宿日。
 */
async function findOrderRowForDayRoomChange(runner, orderNumber, stayDate) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 AND stay_date = $2',
    [orderNumber, stayDate]
  );
  return result.rows[0] || null;
}

/**
 * 查询新房间在目标日期是否已被其他有效订单占用。
 * 已取消和已退房订单不参与占用判断。
 */
async function findActiveRoomConflict(runner, newRoomNumber, stayDate, orderNumber) {
  const result = await runner.query(`
    SELECT order_id, guest_name, room_number, stay_date
    FROM orders
    WHERE room_number = $1
      AND stay_date = $2
      AND order_id != $3
      AND status NOT IN ('cancelled', 'checked-out')
  `, [newRoomNumber, stayDate, orderNumber]);
  return result.rows[0] || null;
}

/**
 * 查询房间基础信息。
 * 每日换房允许跨房型，更新订单时需要同步新房间的 type_code。
 */
async function findRoomByNumber(runner, roomNumber) {
  const result = await runner.query(
    'SELECT room_number, type_code, status, price, is_closed FROM rooms WHERE room_number = $1',
    [roomNumber]
  );
  return result.rows[0] || null;
}

async function findChangeableOrder(runner, orderNumber) {
  const result = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 AND status IN ($2, $3) ORDER BY stay_date LIMIT 1',
    [orderNumber, 'pending', 'checked-in']
  );
  return result.rows[0] || null;
}

async function countRoomConflicts(runner, roomNumber, orderNumber, checkInDate, checkOutDate) {
  const result = await runner.query(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE room_number = $1
      AND status IN ('pending', 'checked-in')
      AND order_id != $2
      AND check_in_date < $4::date
      AND check_out_date > $3::date
  `, [roomNumber, orderNumber, checkInDate, checkOutDate]);
  return parseInt(result.rows[0].count, 10) || 0;
}

async function calculateNights(runner, checkInDate, checkOutDate) {
  const result = await runner.query(
    'SELECT ($2::date - $1::date) AS nights',
    [checkInDate, checkOutDate]
  );
  return Number(result.rows?.[0]?.nights ?? 0);
}

async function updateOrderRoom(runner, orderNumber, roomNumber, roomType, totalPrice) {
  const result = await runner.query(`
    UPDATE orders
    SET room_number = $1, room_type = $2, total_price = $3
    WHERE order_id = $4
    RETURNING *
  `, [roomNumber, roomType, totalPrice, orderNumber]);
  return result.rows[0] || null;
}

async function setRoomStatusOnly(runner, roomNumber, status) {
  return runner.query(
    'UPDATE rooms SET status = $1 WHERE room_number = $2',
    [status, roomNumber]
  );
}

/**
 * 修改订单某一天的房间号和房型。
 * 多日订单只更新指定日期那一行。
 */
async function updateOrderDayRoom(runner, orderNumber, stayDate, newRoomNumber, roomType) {
  const result = await runner.query(`
    UPDATE orders
    SET room_number = $1,
        room_type = $2
    WHERE order_id = $3 AND stay_date = $4
    RETURNING *
  `, [newRoomNumber, roomType, orderNumber, stayDate]);
  return result.rows[0] || null;
}

/**
 * 同步更新目标日期的房费账单房间号。
 * 没有账单时不阻断换房，兼容未办理入住或历史缺账单场景。
 */
async function updateRoomFeeBillRoomNumber(runner, orderNumber, stayDate, newRoomNumber) {
  return runner.query(`
    UPDATE bills
    SET room_number = $1
    WHERE order_id = $2 AND stay_date = $3::date AND change_type = '房费'
    RETURNING bill_id
  `, [newRoomNumber, orderNumber, stayDate]);
}

/**
 * 记录每日换房变更。
 * 变更记录失败不影响主流程，所以不放进换房事务。
 */
async function insertDayRoomChangeLog(orderNumber, changedBy, oldRoomNumber, newRoomNumber, stayDate) {
  return query(
    `INSERT INTO order_changes
      (order_id, changed_by, changes, reason)
     VALUES ($1, $2, $3, $4)`,
    [
      orderNumber,
      changedBy,
      JSON.stringify({
        room_number: { old: oldRoomNumber, new: newRoomNumber },
        stay_date: stayDate
      }),
      `更换 ${stayDate} 的房间`
    ]
  );
}

/**
 * 读取订单押金状态。
 * 押金优先按 orders.deposit 计算，并兼容历史 bills.deposit / refund_deposit 字段。
 */
async function getDepositInfo(orderId) {
  const orderDepositResult = await query('SELECT deposit FROM orders WHERE order_id=$1', [orderId]);
  let deposit = 0;
  if (orderDepositResult.rows.length) {
    deposit = parseFloat(orderDepositResult.rows[0].deposit) || 0;
  }

  if (deposit === 0) {
    const depositColumnResult = await query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='deposit' LIMIT 1"
    );
    if (depositColumnResult.rows.length) {
      const billDepositResult = await query(
        'SELECT deposit FROM bills WHERE order_id=$1 AND COALESCE(deposit,0)>0 ORDER BY create_time ASC LIMIT 1',
        [orderId]
      );
      if (billDepositResult.rows.length) {
        deposit = parseFloat(billDepositResult.rows[0].deposit) || 0;
      }
    }
  }

  let legacyRefunded = 0;
  const refundColumnResult = await query(
    "SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='refund_deposit' LIMIT 1"
  );
  if (refundColumnResult.rows.length) {
    const legacyRefundResult = await query(
      'SELECT ABS(COALESCE(MIN(refund_deposit),0)) AS legacy_refunded FROM bills WHERE order_id=$1',
      [orderId]
    );
    legacyRefunded = parseFloat(legacyRefundResult.rows[0].legacy_refunded) || 0;
  }

  const refundByBillResult = await query(
    "SELECT COALESCE(SUM(CASE WHEN change_type='退押' THEN ABS(COALESCE(change_price,0)) ELSE 0 END),0) AS change_refunded FROM bills WHERE order_id=$1",
    [orderId]
  );
  const changeRefunded = parseFloat(refundByBillResult.rows[0].change_refunded) || 0;
  const refunded = legacyRefunded + changeRefunded;

  let refundRecords = [];
  if (refundColumnResult.rows.length) {
    const { rows } = await query(
      `SELECT
         ABS(
           CASE
             WHEN change_type = '退押' THEN COALESCE(change_price, 0)
             WHEN refund_deposit < 0 THEN refund_deposit
             ELSE 0
           END
         ) AS amount,
         pay_way,
         to_char(COALESCE(refund_time, create_time), 'YYYY-MM-DD HH24:MI:SS') AS time
       FROM bills
       WHERE order_id = $1
         AND (
           change_type = '退押'
           OR (refund_deposit IS NOT NULL AND refund_deposit < 0)
         )
       ORDER BY COALESCE(refund_time, create_time) ASC`,
      [orderId]
    );
    refundRecords = rows.map(row => ({
      amount: toAmountNumber(row.amount || 0),
      method: row.pay_way,
      time: row.time
    }));
  } else {
    const { rows } = await query(
      `SELECT
         ABS(COALESCE(change_price, 0)) AS amount,
         pay_way,
         to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') AS time
       FROM bills
       WHERE order_id = $1 AND change_type = '退押'
       ORDER BY create_time ASC`,
      [orderId]
    );
    refundRecords = rows.map(row => ({
      amount: toAmountNumber(row.amount || 0),
      method: row.pay_way,
      time: row.time
    }));
  }

  const roomFeeResult = await query(
    'SELECT COALESCE(SUM(total_price), 0) AS total_room_fee FROM orders WHERE order_id = $1',
    [orderId]
  );
  const totalRoomFee = toAmountNumber(roomFeeResult.rows?.[0]?.total_room_fee || 0);

  return {
    orderId,
    deposit,
    refunded,
    remaining: Math.max(0, deposit - refunded),
    refundRecords,
    totalRoomFee
  };
}

module.exports = {
  checkOrderTableExists,
  calculateNights,
  countRoomConflicts,
  findOrderRowsByOrderId,
  findOrderRowById,
  findOrderRowForDayRoomChange,
  findActiveRoomConflict,
  findChangeableOrder,
  findRoomByNumber,
  findBillsForSplitUpdate,
  findOrderRowsForCheckout,
  findOrderRowsForEarlyCheckout,
  findOrderRowsForUpdateWithBills,
  findOrderRowsInTransaction,
  findOrderRowsForUpdate,
  getOrderBillNetPaid,
  getDepositInfo,
  getClient,
  cancelOrderAfterCheckin,
  countRoomFeeBillPaymentWays,
  deleteBillsByIds,
  deleteUnstayedOrderRows,
  insertEarlyCheckoutRefundBill,
  insertBillInTransaction,
  insertDayRoomChangeLog,
  insertOrderChangeLog,
  listDailyOrders,
  listOrders,
  markRoomAvailable,
  markRoomCleaning,
  setRoomStatusOnly,
  updateAllBillRoomNumbers,
  updateDailyRoomPrice,
  updateOrderPaymentMethodInTransaction,
  updateOrderEarlyCheckout,
  updateOrderFields,
  updateOrderDayRoom,
  updateOrderRoom,
  updateRoomFeeBillsPaymentMethod,
  updateRoomFeeBillRoomNumber,
  updateOrderStatus,
  updateOrderStatusInTransaction,
  updateSplitBill
};
