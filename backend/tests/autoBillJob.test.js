const { query } = require('../database/postgreDB/pg');
const { runAutoBillJob } = require('../modules/autoBillService');
const { buildOrderPayload, createOrder } = require('./tools');

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

    const payload = buildOrderPayload({
      orderId: testOrderId,
      guestName: 'Auto Guest',
      roomType: TEST_ROOM_TYPE,
      roomNumber: TEST_ROOM_NUMBER,
      checkInDate: '2025-05-01',
      checkOutDate: '2025-05-03',
      roomPrice: {
        '2025-05-01': 200,
        '2025-05-02': 200
      },
      status: 'pending',
      paymentMethod: '微信',
      deposit: 0,
      stayType: '客房',
      remarks: '自动化测试订单',
      isPrepaid: false,
      prepaidAmount: 0
    });

    await createOrder(payload);

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
