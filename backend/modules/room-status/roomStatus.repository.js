const { query } = require('../../database/postgreDB/pg');

async function listRoomStatusRows(queryDate) {
  const sql = `
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
  `;

  const result = await query(sql, [queryDate]);
  return result.rows;
}

async function listRoomStatusRangeRows(roomNumber, startDate, endDate) {
  const sql = `
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
  `;

  const result = await query(sql, [roomNumber, startDate, endDate]);
  return result.rows;
}

async function listCalendarBoardRows(startDate, days, typeCode) {
  const sql = `
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
  `;

  const result = await query(sql, [startDate, days, typeCode]);
  return result.rows;
}

async function updateRoomStatus(number, status, isClosed) {
  const { rows } = await query(
    'UPDATE rooms SET status = $1, is_closed = $2 WHERE room_number = $3 RETURNING *',
    [status, isClosed, number]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  listCalendarBoardRows,
  listRoomStatusRangeRows,
  listRoomStatusRows,
  updateRoomStatus
};
