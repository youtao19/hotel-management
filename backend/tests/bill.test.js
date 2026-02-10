const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom, buildOrderPayload, roomTypes,rooms } = require('./tools');
const { createOrder, checkIn, getOrderById, checkOut } = require('../modules/orderModule');

describe('账单金额调整接口', () => {
  let TEST_ORDER_ID;
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
    const baseOrder = buildOrderPayload({
      orderId: `BILL_BASE_${Date.now()}`,
      roomTypes: 'you_ge_yuan_zi',
      roomNumber: '115',
      checkInDate: '2025-11-10',
      checkOutDate: '2025-11-12',
      roomPrice: {
        '2025-11-10': 188,
        '2025-11-11': 188
      }
    });
    await createOrder(baseOrder);
    TEST_ORDER_ID = baseOrder.orderId;
  });
  test('补收使用正数金额，记录为收入并保留支付方式', async () => {
    const order1 = buildOrderPayload({
      orderId: '测试补收订单1',
      roomTypes: 'yi_jiang_nan',
      roomNumber: '211',
      checkInDate: '2025-11-01',
      checkOutDate: '2025-11-03',
      roomPrice: {
        '2025-11-01': 300,
        '2025-11-02': 320
      }
    });
    await createOrder(order1);

    // 添加补收账单
    const payload = {
      order_id: order1.orderId,
      change_price: 50,
      change_type: '补收',
      method: '现金',
      notes: '补收测试 - 正值'
    };

    const response = await request(app)
      .post('/api/bills/adjustment')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);

    const stored = await query(
      'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 and change_type = $2 ORDER BY create_time DESC LIMIT 1',
      [order1.orderId, payload.change_type]
    );

    expect(stored.rows.length).toBe(1);
    expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(payload.change_price);
    expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(1);
    expect(stored.rows[0].change_type).toBe(payload.change_type);
    expect(stored.rows[0].pay_way).toBe(payload.method);
  });

  test('退款使用负数金额，系统记录为支出', async () => {
    const payload = {
      order_id: TEST_ORDER_ID,
      change_price: -45.5,
      change_type: '退款',
      method: '现金',
      notes: '退款测试 - 负值'
    };

    const response = await request(app)
      .post('/api/bills/add')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);

    const stored = await query(
      'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
      [TEST_ORDER_ID]
    );

    expect(stored.rows.length).toBe(1);
    expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(payload.change_price);
    expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
    expect(stored.rows[0].change_type).toBe(payload.change_type);
    expect(stored.rows[0].pay_way).toBe(payload.method);
    expect(stored.rows[0].remarks).toBe(payload.notes);
  });

  test('退款使用正数金额，系统会自动转换为负值', async () => {
    const payload = {
      order_id: TEST_ORDER_ID,
      change_price: 60,
      change_type: '退款',
      method: '平台',
      notes: '退款测试 - 正值'
    };

    const response = await request(app)
      .post('/api/bills/add')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(-1);

    const stored = await query(
      'SELECT change_price, change_type, pay_way, remarks FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
      [TEST_ORDER_ID]
    );

    expect(stored.rows.length).toBe(1);
    expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(-payload.change_price);
    expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
    expect(stored.rows[0].change_type).toBe(payload.change_type);
    expect(stored.rows[0].pay_way).toBe(payload.method);
    expect(stored.rows[0].remarks).toBe(payload.notes);
  });

  test('不同支付方式被写入账单', async () => {
    const payload = {
      order_id: TEST_ORDER_ID,
      change_price: 10,
      change_type: '补收',
      method: '平台',
      notes: '支付方式测试'
    };

    const response = await request(app)
      .post('/api/bills/add')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);

    const stored = await query(
      'SELECT pay_way FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
      [TEST_ORDER_ID]
    );

    expect(stored.rows.length).toBe(1);
    expect(stored.rows[0].pay_way).toBe(payload.method);
  });

  test('补收使用负数金额时被强制转为正数', async () => {
    const payload = {
      order_id: TEST_ORDER_ID,
      change_price: -30,
      change_type: '补收',
      method: '微邮付',
      notes: '补收测试 - 负值'
    };

    const response = await request(app)
      .post('/api/bills/add')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(1);

    const stored = await query(
      'SELECT change_price FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
      [TEST_ORDER_ID]
    );

    expect(stored.rows.length).toBe(1);
    expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(Math.abs(payload.change_price));
    expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(1);
  });

  test('退押正数金额也会保存为负值', async () => {
    const payload = {
      order_id: TEST_ORDER_ID,
      change_price: 80,
      change_type: '退押',
      method: '现金',
      notes: '退押测试 - 正值'
    };

    const response = await request(app)
      .post('/api/bills/add')
      .send(payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(Math.sign(parseFloat(response.body.data.change_price))).toBe(-1);

    const stored = await query(
      'SELECT change_price FROM bills WHERE order_id = $1 ORDER BY create_time DESC LIMIT 1',
      [TEST_ORDER_ID]
    );

    expect(stored.rows.length).toBe(1);
    expect(parseFloat(stored.rows[0].change_price)).toBeCloseTo(-payload.change_price);
    expect(Math.sign(parseFloat(stored.rows[0].change_price))).toBe(-1);
  });

  test('按日期查询账单时，不应因订单多日记录重复返回同一账单', async () => {
    const uniqueSuffix = Date.now();
    const orderId = `BILL_BY_DATE_${uniqueSuffix}`;
    const targetDate = '2026-02-09';

    const multiDayOrder = buildOrderPayload({
      orderId,
      roomTypes: 'you_ge_yuan_zi',
      roomNumber: '115',
      checkInDate: '2036-01-01',
      checkOutDate: '2036-01-03',
      roomPrice: {
        '2036-01-01': 188,
        '2036-01-02': 188
      }
    });
    await createOrder(multiDayOrder);

    const billInsert = await query(
      `INSERT INTO bills (
        order_id,
        room_number,
        guest_name,
        change_price,
        change_type,
        pay_way,
        create_time,
        stay_type,
        stay_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::date)
      RETURNING bill_id`,
      [
        orderId,
        '115',
        '去重测试',
        100,
        '房费',
        '微信',
        `${targetDate}T08:00:00+08:00`,
        '客房',
        targetDate
      ]
    );

    expect(billInsert.rows.length).toBe(1);
    const insertedBillId = billInsert.rows[0].bill_id;

    const response = await request(app).get(`/api/bills/by-date/${targetDate}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    const { hotelBills = [], restBills = [], carBills = [] } = response.body.data || {};
    const allBills = [...hotelBills, ...restBills, ...carBills];
    const matched = allBills.filter((bill) => bill.order_id === orderId);

    expect(matched.length).toBe(1);
    expect(matched[0].bill_id).toBe(insertedBillId);
  });
});

describe('退押金接口', () => {
  beforeAll(async () => {
    // await addRoomType(roomTypes);
    // await addRoom(rooms);
  });

  test('退还全部押金成功', async () => {
    // 创建订单
    const order = buildOrderPayload({
      orderId: '测试退押订单',
      roomTypes: 'bo_ye_shuang',
      roomNumber: '307',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-05',
      roomPrice: {
        '2025-12-01': 320,
        '2025-12-02': 320,
        '2025-12-03': 350.5,
        '2025-12-04': 360.00
      }
    });
    await createOrder(order);

    const depositAmount = 20
    // 办理入住
    await checkIn(order.orderId,depositAmount);
    // 办理退房
    await checkOut(order.orderId);
    const orderRows = await getOrderById(order.orderId);
    // 办理退房
    const payload = {
      order_id: order.orderId,
      change_price: depositAmount,
      pay_way: '现金',
      notes: '全额退押金',
      create_time: new Date()
    };


    const response = await request(app)
      .post(`/api/orders/${order.orderId}/refund-deposit`)
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.order).toBeDefined();
    expect(response.body.order.change_type).toBe('退押');
    expect(Number(response.body.order.change_price)).toBeCloseTo(-depositAmount, 5);

    const bills = await query(
      `SELECT change_price FROM bills WHERE order_id = $1 and change_type = '退押'`,
      [order.orderId]
    );
    expect(bills.rows.length).toBe(1);
    expect(Number(bills.rows[0].change_price)).toBeCloseTo(-depositAmount, 5);
  });

  test('部分退押金成功', async () => {
    const orderPayload = buildOrderPayload({
      orderId: `测试部分退押_${Date.now()}`,
      roomTypes: 'bo_ye_shuang',
      roomNumber: '308',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-05',
      roomPrice: {
        '2025-12-01': 320,
        '2025-12-02': 320,
        '2025-12-03': 350.5,
        '2025-12-04': 360.00
      }
    });
    // 创建订单
    await createOrder(orderPayload);


    const depositAmount = 30
    // 办理入住
    await checkIn(orderPayload.orderId,depositAmount);
    // 办理退房
    await checkOut(orderPayload.orderId);
    const refundData = {
      order_id: orderPayload.orderId,
      change_price: 12,
      pay_way: '微信',
      notes: '部分退押金',
      create_time: new Date()
    }

    const response = await request(app)
      .post(`/api/orders/${orderPayload.orderId}/refund-deposit`)
      .send(refundData);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('退押金处理成功');
    expect(response.body.order).toBeDefined();
    expect(response.body.order.change_type).toBe('退押');
    expect(Number(response.body.order.change_price)).toBeCloseTo(-refundData.change_price, 5);

    const bills = await query(
      `SELECT change_price, change_type, pay_way FROM bills WHERE order_id = $1 and change_type = '退押'`,
      [orderPayload.orderId]
    );
    expect(bills.rows.length).toBe(1);
    expect(bills.rows[0].change_type).toBe('退押');
    expect(Number(bills.rows[0].change_price)).toBeCloseTo(-refundData.change_price, 5);
    expect(bills.rows[0].pay_way).toBe(refundData.pay_way);

    // 验证押金状态
    const depositInfo = await request(app)
      .get(`/api/orders/${orderPayload.orderId}/deposit-info`);

    expect(depositInfo.statusCode).toBe(200);
    expect(depositInfo.body.success).toBe(true);
    expect(Number(depositInfo.body.data.deposit)).toBeCloseTo(30, 5);
    expect(Number(depositInfo.body.data.refunded)).toBeCloseTo(refundData.change_price, 5);
    expect(Number(depositInfo.body.data.remaining)).toBeCloseTo(18, 5);
  });


});
