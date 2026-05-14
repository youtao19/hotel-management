const { query, getClient } = require('../../database/postgreDB/pg');

async function runQuery(runner, sql, params) {
  if (runner) {
    return runner.query(sql, params);
  }
  return query(sql, params);
}

async function listRoomsByDate(queryDate) {
  return query(`
    WITH selected_date AS (
      SELECT COALESCE($1::date, CURRENT_DATE) AS stay_date
    )
    SELECT
      sd.stay_date::text AS query_date,
      r.room_id,
      r.room_number,
      r.type_code,
      rt.type_name,
      r.status,
      r.price,
      r.is_closed,
      o.guest_name,
      o.phone,
      o.remarks,
      o.check_out_date,
      o.order_status,
      o.order_id,
      o.check_in_date,
      o.stay_type,
      CASE
        WHEN r.is_closed = TRUE OR r.status = 'repair' THEN 'repair'
        WHEN o.order_status IN ('checked-in', 'occupied') THEN 'occupied'
        WHEN o.order_status IN ('pending', 'reserved') THEN 'reserved'
        WHEN r.status = 'cleaning' THEN 'cleaning'
        ELSE 'available'
      END AS display_status
    FROM rooms r
    CROSS JOIN selected_date sd
    LEFT JOIN room_types rt ON rt.type_code = r.type_code
    LEFT JOIN LATERAL (
      SELECT
        o.guest_name,
        o.phone,
        o.remarks,
        o.check_out_date,
        o.status AS order_status,
        o.order_id,
        o.check_in_date,
        o.stay_type
      FROM orders o
      WHERE o.room_number = r.room_number
        AND o.stay_date = sd.stay_date
        AND o.status IN ('pending', 'reserved', 'checked-in', 'occupied')
      ORDER BY
        CASE
          WHEN o.status IN ('checked-in', 'occupied') THEN 2
          WHEN o.status IN ('pending', 'reserved') THEN 1
          ELSE 0
        END DESC,
        o.create_time DESC
      LIMIT 1
    ) o ON TRUE
    ORDER BY r.room_number
  `, [queryDate]);
}

async function listRoomStatusRange(roomNumber, startDate, endDate) {
  const result = await query(`
    WITH date_series AS (
      SELECT generate_series($2::date, $3::date, interval '1 day')::date AS stay_date
    ),
    room_row AS (
      SELECT room_number, type_code, status, price, is_closed
      FROM rooms
      WHERE room_number = $1
      LIMIT 1
    ),
    order_candidates AS (
      SELECT
        o.stay_date,
        o.order_id,
        o.guest_name,
        o.check_in_date,
        o.check_out_date,
        o.status AS order_status,
        o.create_time,
        CASE
          WHEN o.status IN ('checked-in', 'occupied') THEN 2
          WHEN o.status IN ('pending', 'reserved') THEN 1
          ELSE 0
        END AS status_rank
      FROM orders o
      WHERE o.room_number = $1
        AND o.stay_date >= $2::date
        AND o.stay_date <= $3::date
        AND o.status IN ('pending', 'reserved', 'checked-in', 'occupied')
    ),
    best_order AS (
      SELECT DISTINCT ON (stay_date)
        stay_date,
        order_id,
        guest_name,
        check_in_date,
        check_out_date,
        order_status
      FROM order_candidates
      ORDER BY stay_date, status_rank DESC, create_time DESC
    )
    SELECT
      ds.stay_date::text AS stay_date,
      r.room_number,
      r.type_code,
      r.price,
      r.status AS room_status,
      r.is_closed,
      bo.order_id,
      bo.guest_name,
      bo.check_in_date,
      bo.check_out_date,
      bo.order_status,
      CASE
        WHEN r.is_closed = TRUE OR r.status = 'repair' THEN 'repair'
        WHEN bo.order_status IN ('checked-in', 'occupied') THEN 'occupied'
        WHEN bo.order_status IN ('pending', 'reserved') THEN 'reserved'
        WHEN r.status = 'cleaning' THEN 'cleaning'
        ELSE 'available'
      END AS display_status
    FROM date_series ds
    CROSS JOIN room_row r
    LEFT JOIN best_order bo ON bo.stay_date = ds.stay_date
    ORDER BY ds.stay_date
  `, [roomNumber, startDate, endDate]);
  return result.rows;
}

async function listCalendarBoardRows(startDate, days, typeCode) {
  const result = await query(`
    WITH date_series AS (
      SELECT generate_series(
        $1::date,
        ($1::date + (($2::int - 1) * interval '1 day'))::date,
        interval '1 day'
      )::date AS stay_date
    ),
    room_base AS (
      SELECT
        r.room_number,
        r.type_code,
        rt.type_name,
        r.status,
        r.price,
        r.is_closed
      FROM rooms r
      LEFT JOIN room_types rt ON rt.type_code = r.type_code
      WHERE ($3::text IS NULL OR r.type_code = $3)
    )
    SELECT
      ds.stay_date::text AS stay_date,
      rb.room_number,
      rb.type_code,
      rb.type_name,
      rb.price,
      rb.status AS room_status,
      rb.is_closed,
      bo.order_id,
      bo.guest_name,
      bo.phone,
      bo.remarks,
      bo.check_in_date,
      bo.check_out_date,
      bo.order_status,
      CASE
        WHEN rb.is_closed = TRUE OR rb.status = 'repair' THEN 'repair'
        WHEN bo.order_status IN ('checked-in', 'occupied') THEN 'occupied'
        WHEN bo.order_status IN ('pending', 'reserved') THEN 'reserved'
        WHEN rb.status = 'cleaning' THEN 'cleaning'
        ELSE 'available'
      END AS display_status
    FROM date_series ds
    CROSS JOIN room_base rb
    LEFT JOIN LATERAL (
      SELECT
        o.order_id,
        o.guest_name,
        o.phone,
        o.remarks,
        o.check_in_date,
        o.check_out_date,
        o.status AS order_status,
        o.create_time
      FROM orders o
      WHERE o.room_number = rb.room_number
        AND o.stay_date = ds.stay_date
        AND o.status IN ('pending', 'reserved', 'checked-in', 'occupied')
      ORDER BY
        CASE
          WHEN o.status IN ('checked-in', 'occupied') THEN 2
          WHEN o.status IN ('pending', 'reserved') THEN 1
          ELSE 0
        END DESC,
        o.create_time DESC
      LIMIT 1
    ) bo ON TRUE
    ORDER BY rb.type_code, rb.room_number, ds.stay_date
  `, [startDate, days, typeCode]);
  return result.rows;
}

async function findRoomByNumber(roomNumber, runner = null) {
  const result = await runQuery(runner, 'SELECT * FROM rooms WHERE room_number = $1', [roomNumber]);
  return result.rows[0] || null;
}

async function updateRoomStatus(runner, roomNumber, status, isClosed) {
  const result = await runQuery(
    runner,
    'UPDATE rooms SET status = $1, is_closed = $2 WHERE room_number = $3 RETURNING *',
    [status, isClosed, roomNumber]
  );
  return result.rows[0] || null;
}

async function checkRoomExists(runner, roomNumber) {
  const result = await runner.query('SELECT 1 FROM rooms WHERE room_number = $1', [roomNumber]);
  return result.rows.length > 0;
}

async function findRoomTypeBasePrice(runner, typeCode) {
  const result = await runner.query('SELECT base_price FROM room_types WHERE type_code = $1', [typeCode]);
  return result.rows[0] || null;
}

async function getRoomIdColumnInfo(runner) {
  const result = await runner.query(`
    SELECT column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
      AND column_name = 'room_id'
  `);
  return result.rows[0] || null;
}

async function getNextRoomId(runner) {
  const seqResult = await runner.query('SELECT pg_get_serial_sequence($1, $2) AS seq_name', ['rooms', 'room_id']);
  const seqRow = seqResult.rows && seqResult.rows[0];

  if (seqRow && seqRow.seq_name) {
    const nextValResult = await runner.query('SELECT nextval($1) AS next_id', [seqRow.seq_name]);
    return Number(nextValResult.rows[0].next_id);
  }

  const nextIdResult = await runner.query('SELECT COALESCE(MAX(room_id), 0) + 1 AS next_id FROM rooms');
  return Number(nextIdResult.rows[0].next_id || 1);
}

async function insertRoom(runner, roomData) {
  const { roomId, room_number, type_code, status, price } = roomData;

  if (roomId !== undefined && roomId !== null) {
    const result = await runner.query(
      'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [roomId, room_number, type_code, status, price]
    );
    return result.rows[0];
  }

  const result = await runner.query(
    'INSERT INTO rooms (room_number, type_code, status, price) VALUES ($1, $2, $3, $4) RETURNING *',
    [room_number, type_code, status, price]
  );
  return result.rows[0];
}

async function updateRoom(roomNumber, roomData) {
  const result = await query(
    'UPDATE rooms SET type_code = $1, status = $2, price = $3 WHERE room_number = $4 RETURNING *',
    [roomData.type_code, roomData.status, roomData.price, roomNumber]
  );
  return result.rows[0] || null;
}

async function countActiveOrdersByRoom(roomNumber) {
  const result = await query(
    'SELECT COUNT(*) as count FROM orders WHERE room_number = $1 AND status IN ($2, $3)',
    [roomNumber, 'pending', 'checked-in']
  );
  return parseInt(result.rows[0].count, 10) || 0;
}

async function deleteRoom(roomNumber) {
  return query('DELETE FROM rooms WHERE room_number = $1', [roomNumber]);
}

async function listAvailableRooms(startDate, endDate, typeCode = null) {
  const queryParams = [startDate, endDate];
  let typeFilter = '';

  if (typeCode) {
    queryParams.push(typeCode);
    typeFilter = `AND r.type_code = $${queryParams.length}::varchar`;
  }

  const result = await query(`
    SELECT r.room_number, r.type_code, r.status, r.price, r.is_closed
    FROM rooms r
    WHERE r.is_closed = FALSE
      AND r.status != 'repair'
      AND NOT EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.room_number = r.room_number
          AND o.status NOT IN ('cancelled', 'checked-out')
          AND o.stay_date >= $1::date
          AND o.stay_date < (
            CASE
              WHEN $1::date = $2::date THEN ($1::date + 1)
              ELSE $2::date
            END
          )
      )
      ${typeFilter}
    ORDER BY r.room_number
  `, queryParams);
  return result.rows;
}

async function findChangeableOrder(orderNumber) {
  const result = await query(
    'SELECT * FROM orders WHERE order_id = $1 AND status IN ($2, $3)',
    [orderNumber, 'pending', 'checked-in']
  );
  return result.rows[0] || null;
}

async function countRoomConflicts(roomNumber, orderNumber, checkInDate, checkOutDate) {
  const result = await query(`
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

async function calculateNights(checkInDate, checkOutDate) {
  const result = await query(
    'SELECT ($2::date - $1::date) AS nights',
    [checkInDate, checkOutDate]
  );
  return Number(result.rows?.[0]?.nights ?? 0);
}

async function updateOrderRoom(orderNumber, roomNumber, roomType, totalPrice) {
  const result = await query(`
    UPDATE orders
    SET room_number = $1, room_type = $2, total_price = $3
    WHERE order_id = $4
    RETURNING *
  `, [roomNumber, roomType, totalPrice, orderNumber]);
  return result.rows[0] || null;
}

async function setRoomStatusOnly(roomNumber, status) {
  return query(
    'UPDATE rooms SET status = $1 WHERE room_number = $2',
    [status, roomNumber]
  );
}

async function beginGlobalTransaction() {
  return query('BEGIN');
}

async function commitGlobalTransaction() {
  return query('COMMIT');
}

async function rollbackGlobalTransaction() {
  return query('ROLLBACK');
}

module.exports = {
  beginGlobalTransaction,
  calculateNights,
  checkRoomExists,
  commitGlobalTransaction,
  countActiveOrdersByRoom,
  countRoomConflicts,
  deleteRoom,
  findChangeableOrder,
  findRoomByNumber,
  findRoomTypeBasePrice,
  getClient,
  getNextRoomId,
  getRoomIdColumnInfo,
  insertRoom,
  listAvailableRooms,
  listCalendarBoardRows,
  listRoomsByDate,
  listRoomStatusRange,
  rollbackGlobalTransaction,
  setRoomStatusOnly,
  updateOrderRoom,
  updateRoom,
  updateRoomStatus
};
