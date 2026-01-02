const assert = require('assert');
const request = require('supertest');
const app = require('../app');
const db = require('../database/postgreDB/pg');
const { createOrder } = require('../modules/orderModule');

async function ensureSeedData() {
  await db.query(
    `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (type_code) DO NOTHING`,
    ['TEST_STD_ROOM', '测试标准房', 100, '用于脚本测试的房型', false]
  );

  await db.query(
    `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (room_number) DO NOTHING`,
    ['TEST_ROOM_101', 'TEST_STD_ROOM', 'available', 100, false]
  );
}

async function main() {
  await db.initializePostgreDB();
  await app.initializeSession();

  await ensureSeedData();

  const orderId = `TEST_EC_REC_${Date.now()}`;
  const checkInDate = '2025-12-10';
  const checkOutDate = '2025-12-12';

  const orderPayload = {
    orderId,
    sourceNumber: '',
    orderSource: 'front_desk',
    guestName: '提前退房推荐-测试客人',
    roomType: 'TEST_STD_ROOM',
    roomNumber: 'TEST_ROOM_101',
    checkInDate,
    checkOutDate,
    status: 'pending',
    paymentMethod: '现金',
    phone: '',
    roomPrice: {
      '2025-12-10': 100,
      '2025-12-11': 120
    },
    deposit: 0,
    isPrepaid: false,
    prepaidAmount: 0,
    stayType: '客房',
    remarks: 'script test'
  };

  await createOrder(orderPayload);

  const checkInResp = await request(app)
    .post(`/api/orders/${orderId}/check-in`)
    .send({ deposit: 20 });
  assert.equal(checkInResp.statusCode, 200);
  assert.equal(checkInResp.body.success, true);

  const recResp = await request(app)
    .get(`/api/orders/${orderId}/early-checkout/recommendation`)
    .query({ actualCheckoutTime: '2025-12-11T07:30', hasStayed: true });

  assert.equal(recResp.statusCode, 200);
  assert.equal(recResp.body.success, true);
  assert.equal(recResp.body.data.orderNumber, orderId);
  assert.equal(recResp.body.data.originalCheckoutDate, checkOutDate);
  assert.equal(recResp.body.data.actualCheckoutDate, '2025-12-11');
  assert.equal(recResp.body.data.isEarly, true);
  assert.equal(recResp.body.data.refundableNights.length, 1);
  assert.equal(recResp.body.data.refundableNights[0].stayDate, '2025-12-11');
  assert.equal(Number(recResp.body.data.recommendedRefund).toFixed(2), '120.00');

  const recNoStayResp = await request(app)
    .get(`/api/orders/${orderId}/early-checkout/recommendation`)
    .query({ actualCheckoutTime: '2025-12-11T07:30', hasStayed: false });

  assert.equal(recNoStayResp.statusCode, 200);
  assert.equal(recNoStayResp.body.success, true);
  assert.equal(recNoStayResp.body.data.refundableNights.length, 0);
  assert.equal(Number(recNoStayResp.body.data.recommendedRefund).toFixed(2), '240.00');

  await db.query('DELETE FROM bills WHERE order_id = $1', [orderId]);
  await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]);

  console.log('[PASS] early-checkout recommendation test');
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[FAIL] early-checkout recommendation test');
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await db.closePool();
      } catch {
        // ignore
      }
    });
}
