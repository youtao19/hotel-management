/****
 * 文件作用：
 * 订单创建模块的数据访问层。
 *
 * 这个文件只负责和 PostgreSQL 数据库交互，包含：
 * 1. 查询入住日期列表；
 * 2. 插入每日订单记录；
 * 3. 查询订单明细；
 * 4. 更新订单支付方式、押金、状态；
 * 5. 更新房间状态；
 * 6. 查询订单账单。
 *
 * 注意：
 * - 业务规则不要写在 repository 层，应该放在 service 层；
 * - 这里尽量保持“一个函数对应一次数据库操作”；
 * - 涉及事务的函数需要使用外部传入的 runner/client，保证多条 SQL 在同一个事务中执行。
 */
const { query, getClient } = require('../../database/postgreDB/pg');

/**
 * 执行数据库查询。
 *
 * 为什么这样写：
 * - 有些查询需要参与事务，必须使用同一个 client；
 * - 有些查询不需要事务，可以直接使用全局 query；
 * - 通过这个函数统一兼容两种场景。
 */
async function runQuery(runner, sql, params) {
  if (runner) {
    return runner.query(sql, params);
  }
  return query(sql, params);
}

/**
 * 查询入住期间的所有住宿日期。
 *
 * 业务规则：
 * - 住宿日期包含入住日；
 * - 不包含离店日；
 * - 例如 5 月 1 日入住，5 月 3 日离店，实际住宿日是 5 月 1 日和 5 月 2 日。
 *
 * SQL 说明：
 * - generate_series 用来生成连续日期；
 * - ($2::date - INTERVAL '1 day') 表示截止到离店日前一天。
 */
async function listStayDates(formattedCheckInDate, formattedCheckOutDate, runner) {
  const { rows } = await runQuery(
    runner,
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS stay_date
       FROM generate_series($1::date, ($2::date - INTERVAL '1 day'), INTERVAL '1 day') d`,
    [formattedCheckInDate, formattedCheckOutDate]
  );
  return rows.map(row => row.stay_date);
}

/**
 * 插入某一天的订单记录。
 *
 * 注意：
 * - 当前系统采用“一晚一条订单记录”的设计；
 * - 多晚订单会向 orders 表插入多行，order_id 相同，stay_date 不同；
 * - values 的顺序非常重要，调用方需要保证字段顺序正确。
 */
async function insertOrderDay(runner, values) {
  return runner.query(
    `INSERT INTO orders (
      order_id, id_source, order_source, guest_name, phone,
      room_type, room_number, check_in_date, check_out_date, stay_date, status,
      payment_method, total_price, deposit, is_prepaid, prepaid_amount,
      stay_type, remarks
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING *;`,
    values
  );
}

/**
 * 查询某个订单在入住时需要用到的所有订单行。
 *
 * 为什么要按 stay_date 排序：
 * - 后续生成账单、拆分房费时，需要按住宿日期顺序处理；
 * - 排序可以避免数据库默认返回顺序不稳定导致业务结果变化。
 */
async function listOrderRowsForCheckIn(runner, orderId) {
  const { rows } = await runner.query(
    'SELECT * FROM orders WHERE order_id = $1 ORDER BY stay_date',
    [orderId]
  );
  return rows;
}

/**
 * 更新订单的支付方式。
 *
 * 注意：
 * - 因为一个 order_id 可能对应多天订单记录，所以这里会更新同一个 order_id 下的所有订单行；
 * - 支付方式是否合法应由 service 层提前校验。
 */
async function updateOrderPaymentMethod(runner, orderId, paymentMethod) {
  return runner.query(
    `UPDATE orders
        SET payment_method = $1
      WHERE order_id = $2`,
    [paymentMethod, orderId]
  );
}

/**
 * 更新某一条订单行的押金金额。
 *
 * 为什么按 orderRowId 更新：
 * - 多晚订单在 orders 表中有多行；
 * - 押金通常只需要挂在其中一条订单行上，避免每晚重复记录押金。
 */
async function updateOrderDeposit(runner, orderRowId, deposit) {
  return runner.query(
    `UPDATE orders
        SET deposit = $1
      WHERE id = $2`,
    [deposit, orderRowId]
  );
}

/**
 * 更新订单状态。
 *
 * 注意：
 * - 同一个 order_id 可能对应多条住宿日记录；
 * - UPDATE 会更新所有匹配行；
 * - RETURNING * 会返回所有更新行，这里只取 rows[0]，通常用于给调用方确认更新结果。
 */
async function updateOrderStatus(runner, orderId, status) {
  const { rows } = await runner.query(
    'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
    [status, orderId]
  );
  return rows[0] || null;
}

/**
 * 更新房间状态。
 *
 * 业务规则：
 * - 入住成功后，通常需要把房间状态改为已入住；
 * - 退房或取消时，可能需要改回空房或待打扫；
 * - 具体状态值应由 service 层决定，repository 层只负责执行更新。
 */
async function updateRoomStatus(runner, roomNumber, status) {
  return runner.query(
    'UPDATE rooms SET status = $1 WHERE room_number = $2',
    [status, roomNumber]
  );
}

/**
 * 查询某个订单的所有账单记录。
 *
 * 注意：
 * - 这里没有传 runner，默认使用全局 query；
 * - 适合普通查询场景；
 * - 如果未来需要在事务中查询账单，可以扩展 runner 参数。
 */
async function listBillsByOrderId(orderId) {
  const { rows } = await query(
    'SELECT * FROM bills WHERE order_id = $1 ORDER BY stay_date, bill_id',
    [orderId]
  );
  return rows;
}

module.exports = {
  getClient,
  insertOrderDay,
  listBillsByOrderId,
  listOrderRowsForCheckIn,
  listStayDates,
  updateOrderDeposit,
  updateOrderPaymentMethod,
  updateOrderStatus,
  updateRoomStatus
};
