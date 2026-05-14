const { query, getClient } = require('../../database/postgreDB/pg');

async function runQuery(runner, sql, params) {
  if (runner) {
    return runner.query(sql, params);
  }
  return query(sql, params);
}

async function findRoomByNumber(roomNumber, runner = null) {
  const result = await runQuery(runner, 'SELECT * FROM rooms WHERE room_number = $1', [roomNumber]);
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

async function listRoomTypes() {
  const result = await query('SELECT * FROM room_types ORDER BY type_code');
  return result.rows;
}

async function findRoomTypeByCode(typeCode, runner = null) {
  const result = await runQuery(runner, 'SELECT * FROM room_types WHERE type_code = $1', [typeCode]);
  return result.rows[0] || null;
}

async function insertRoomType(roomTypeData) {
  const result = await query(
    'INSERT INTO room_types (type_code, type_name, base_price, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [
      roomTypeData.type_code,
      roomTypeData.type_name,
      roomTypeData.base_price,
      roomTypeData.description || null
    ]
  );
  return result.rows[0];
}

async function updateRoomType(runner, typeCode, roomTypeData) {
  const result = await runner.query(
    'UPDATE room_types SET type_name = $1, base_price = $2, description = $3 WHERE type_code = $4 RETURNING *',
    [roomTypeData.type_name, roomTypeData.base_price, roomTypeData.description || null, typeCode]
  );
  return result.rows[0] || null;
}

async function syncRoomPriceByType(runner, typeCode, basePrice) {
  return runner.query(
    'UPDATE rooms SET price = $1 WHERE type_code = $2',
    [basePrice, typeCode]
  );
}

async function countOrdersByRoomType(typeCode) {
  const result = await query('SELECT COUNT(*) as count FROM orders WHERE room_type = $1', [typeCode]);
  return parseInt(result.rows[0].count, 10) || 0;
}

async function countRoomsByType(typeCode) {
  const result = await query('SELECT COUNT(*) as count FROM rooms WHERE type_code = $1', [typeCode]);
  return parseInt(result.rows[0].count, 10) || 0;
}

async function deleteRoomType(typeCode) {
  return query('DELETE FROM room_types WHERE type_code = $1', [typeCode]);
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

module.exports = {
  checkRoomExists,
  countActiveOrdersByRoom,
  countOrdersByRoomType,
  countRoomsByType,
  deleteRoom,
  deleteRoomType,
  findRoomByNumber,
  findRoomTypeByCode,
  findRoomTypeBasePrice,
  getClient,
  getNextRoomId,
  getRoomIdColumnInfo,
  insertRoom,
  insertRoomType,
  listAvailableRooms,
  listRoomTypes,
  updateRoom,
  updateRoomType,
  syncRoomPriceByType
};
