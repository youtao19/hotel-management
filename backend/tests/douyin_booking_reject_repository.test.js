const { query } = require('../database/postgreDB/pg');
const repository = require('../modules/douyin/presale-order/bookingOrder.repository');

describe('抖音预约拒单库存释放', () => {
  const localOrderId = 'DYBK_REJECT_RELEASE_001';
  const douyinOrderId = 'DY_BOOKING_REJECT_RELEASE_001';
  const roomTypeCode = 'DY_RJ';
  const roomNumber = 'DYRJ01';

  beforeEach(async () => {
    await query('DELETE FROM orders WHERE order_id = $1', [localOrderId]);
    await query('DELETE FROM douyin_presale_booking_orders WHERE order_id = $1', [localOrderId]);
    await query('DELETE FROM rooms WHERE room_number = $1', [roomNumber]);
    await query('DELETE FROM room_types WHERE type_code = $1', [roomTypeCode]);
    await query(
      `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [roomTypeCode, '拒单测试房型', 399, '验证拒单释放库存']
    );
    await query(
      `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
       VALUES ($1, $2, 'available', 399, FALSE)`,
      [roomNumber, roomTypeCode]
    );
    await query(
      `INSERT INTO douyin_presale_booking_orders (
         order_id, ota_order_id, source_order_id, hotel_id, rate_plan_id, room_id,
         biz_type, booking_status, confirm_status, assigned_rooms, daily_rates, raw_payload,
         check_in_date, check_out_date, number_of_units, number_of_guests, total_amount
       ) VALUES (
         $1, $2, 'DY_SOURCE_REJECT_001', 'DY_HOTEL_001', 'DY_RATE_001', 'DY_ROOM_001',
         2012, 'CREATED', 'PENDING', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb,
         '2026-08-12'::date, '2026-08-13'::date, 1, 1, 39900
       )`,
      [localOrderId, douyinOrderId]
    );
    await query(
      `INSERT INTO orders (
         order_id, id_source, order_source, guest_name, room_type, room_number,
         check_in_date, check_out_date, stay_date, status
       ) VALUES (
         $1, $2, 'douyin_presale', '拒单测试客人', $3, $4,
         '2026-08-12'::date, '2026-08-13'::date, '2026-08-12'::date, 'pending'
       )`,
      [localOrderId, douyinOrderId, roomTypeCode, roomNumber]
    );
  });

  afterEach(async () => {
    await query('DELETE FROM orders WHERE order_id = $1', [localOrderId]);
    await query('DELETE FROM douyin_presale_booking_orders WHERE order_id = $1', [localOrderId]);
    await query('DELETE FROM rooms WHERE room_number = $1', [roomNumber]);
    await query('DELETE FROM room_types WHERE type_code = $1', [roomTypeCode]);
  });

  test('拒单成功后更新预约状态并释放本地占房', async () => {
    await repository.markConfirmRejected(localOrderId, {
      logId: 'DY_REJECT_LOG_001',
      rejectCode: 9,
      rejectReason: '库存不足',
      response: { extra: { error_code: 0, logid: 'DY_REJECT_LOG_001' } }
    });

    const booking = await query(
      `SELECT booking_status, confirm_status, reject_code, reject_reason, confirm_log_id
       FROM douyin_presale_booking_orders WHERE order_id = $1`,
      [localOrderId]
    );
    const localOrder = await query(
      `SELECT status FROM orders WHERE order_id = $1 AND order_source = 'douyin_presale'`,
      [localOrderId]
    );

    expect(booking.rows[0]).toEqual({
      booking_status: 'REJECTED',
      confirm_status: 'REJECTED',
      reject_code: 9,
      reject_reason: '库存不足',
      confirm_log_id: 'DY_REJECT_LOG_001'
    });
    expect(localOrder.rows).toEqual([{ status: 'cancelled' }]);
  });
});
