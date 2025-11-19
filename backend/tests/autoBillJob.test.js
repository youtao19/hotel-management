const { query } = require('../database/postgreDB/pg');
const { runAutoBillJob } = require('../modules/autoBillService');

const TEST_ROOM_TYPE = 'AUTO_BILL_TYPE';
const TEST_ROOM_NUMBER = 'AUTO_R01';
const TARGET_DATE = '2025-05-02';

describe('自动账单定时任务', () => {
  const testOrderId = `AUTO_BILL_${Date.now()}`;

  beforeAll(async () => {
    await query(
      `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
       VALUES ($1, '自动化房型', 288.00, 'auto bill test', false)
       ON CONFLICT (type_code) DO NOTHING`,
      [TEST_ROOM_TYPE]
    );

    await query(
      `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
       VALUES ($1, $2, 'available', 288.00, false)
       ON CONFLICT (room_number) DO UPDATE SET type_code = EXCLUDED.type_code`,
      [TEST_ROOM_NUMBER, TEST_ROOM_TYPE]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM bills WHERE order_id = $1', [testOrderId]);
    await query('DELETE FROM orders WHERE order_id = $1', [testOrderId]);
    await query('DELETE FROM rooms WHERE room_number = $1', [TEST_ROOM_NUMBER]);
    await query('DELETE FROM room_types WHERE type_code = $1', [TEST_ROOM_TYPE]);
  });

  test('覆盖目标日期的待入住订单会在 18:00 任务中生成日账单', async () => {
    await query('DELETE FROM bills WHERE order_id = $1', [testOrderId]);
    await query('DELETE FROM orders WHERE order_id = $1', [testOrderId]);

    await query(
      `INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone,
        room_type, room_number, check_in_date, check_out_date,
        status, payment_method, total_price, deposit, create_time,
        stay_type, remarks, is_prepaid, prepaid_amount, prepaid_at
      ) VALUES (
        $1, '', 'front_desk', 'Auto Guest', '13800138000',
        $2, $3, $4::date, $5::date,
        'pending', '微信', 400.00, 0, NOW(),
        '客房', '自动化测试订单', false, 0, NULL
      )`,
      [testOrderId, TEST_ROOM_TYPE, TEST_ROOM_NUMBER, '2025-05-01', '2025-05-03']
    );

    const firstRun = await runAutoBillJob({
      targetDate: TARGET_DATE,
      manualTrigger: true,
      forceRun: true,
      disableReport: true
    });

    expect(firstRun.createdBills.length).toBe(1);
    expect(firstRun.failures.length).toBe(0);

    const storedBills = await query(
      `SELECT change_price, pay_way, stay_date::text AS stay_date
       FROM bills
       WHERE order_id = $1 AND stay_date = $2::date`,
      [testOrderId, TARGET_DATE]
    );

    expect(storedBills.rowCount).toBe(1);
    expect(Number(storedBills.rows[0].change_price)).toBeCloseTo(200, 2);
    expect(storedBills.rows[0].stay_date).toBe(TARGET_DATE);

    const secondRun = await runAutoBillJob({
      targetDate: TARGET_DATE,
      manualTrigger: true,
      forceRun: true,
      disableReport: true
    });

    expect(secondRun.createdBills.length).toBe(0);
    expect(secondRun.skippedExisting).toContain(testOrderId);
  });
});
