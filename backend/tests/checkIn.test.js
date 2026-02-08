const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const { addRoomType, addRoom, buildOrderPayload, roomTypes, rooms, ORDERS} = require('./tools');
const {createOrder} = require('../modules/orderModule');


describe('办理入住接口', () => {
  beforeAll(async () => {
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });


  test('收取押金办理入住会生成押金账单', async () => {
    const orderPayload = buildOrderPayload({
      status: 'pending',
      deposit: 0
    });
    await createOrder(orderPayload);
    const orderId = orderPayload.orderId;
    const depositAmount = 20;

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({ deposit: depositAmount });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('办理入住成功');

    // 检查押金账单
    const bills = await query('SELECT change_type, change_price FROM bills WHERE order_id = $1 and change_type = $2', [orderId, '收押']);
    expect(bills.rows.length).toBe(1);
    expect(Number(bills.rows[0].change_price)).toBeCloseTo(depositAmount, 5);

    // 检查订单状态和押金金额
    const updatedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(updatedOrder.rows[0].status).toBe('checked-in');
    expect(Number(updatedOrder.rows[0].deposit)).toBeCloseTo(depositAmount, 5);

  });

  test('办理入住可单独指定押金支付方式', async () => {
    const orderPayload = buildOrderPayload({
      orderId: `deposit_method_${Date.now()}`,
      guestName: `押金方式客户_${Date.now()}`,
      status: 'pending',
      paymentMethod: '现金',
      deposit: 0
    });
    await createOrder(orderPayload);

    const response = await request(app)
      .post(`/api/orders/${orderPayload.orderId}/check-in`)
      .send({
        deposit: 66,
        depositPaymentMethod: '微信'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    const depositBill = await query(
      `SELECT pay_way, change_price
         FROM bills
        WHERE order_id = $1
          AND change_type = '收押'
        ORDER BY bill_id ASC
        LIMIT 1`,
      [orderPayload.orderId]
    );

    expect(depositBill.rows.length).toBe(1);
    expect(depositBill.rows[0].pay_way).toBe('微信');
    expect(Number(depositBill.rows[0].change_price)).toBeCloseTo(66, 5);
  });

  test('支持房费与押金拆分支付办理入住', async () => {
    const orderPayload = buildOrderPayload({
      orderId: `split_checkin_${Date.now()}`,
      guestName: '拆分支付测试客户',
      roomType: 'bo_ye_shuang',
      roomNumber: '307',
      checkInDate: '2025-12-11',
      checkOutDate: '2025-12-13',
      roomPrice: {
        '2025-12-11': 100,
        '2025-12-12': 120
      },
      paymentMethod: '现金',
      status: 'pending',
      deposit: 0
    });
    await createOrder(orderPayload);

    const response = await request(app)
      .post(`/api/orders/${orderPayload.orderId}/check-in`)
      .send({
        deposit: 80,
        roomFeePaymentSplits: {
          '2025-12-11': [
            { method: '现金', amount: 40 },
            { method: '微信', amount: 60 }
          ],
          '2025-12-12': [
            { method: '微信', amount: 20 },
            { method: '微邮付', amount: 100 }
          ]
        },
        depositPaymentSplits: [
          { method: '现金', amount: 30 },
          { method: '微信', amount: 50 }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    const roomFeeGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '房费'
        GROUP BY pay_way`,
      [orderPayload.orderId]
    );
    const roomFeeMap = Object.fromEntries(
      roomFeeGrouped.rows.map(row => [row.pay_way, Number(row.total)])
    );
    expect(roomFeeMap['现金']).toBeCloseTo(40, 5);
    expect(roomFeeMap['微信']).toBeCloseTo(80, 5);
    expect(roomFeeMap['微邮付']).toBeCloseTo(100, 5);

    const depositGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '收押'
        GROUP BY pay_way`,
      [orderPayload.orderId]
    );
    const depositMap = Object.fromEntries(
      depositGrouped.rows.map(row => [row.pay_way, Number(row.total)])
    );
    expect(depositMap['现金']).toBeCloseTo(30, 5);
    expect(depositMap['微信']).toBeCloseTo(50, 5);

    const orderSummary = await query(
      'SELECT payment_method FROM orders WHERE order_id = $1 LIMIT 1',
      [orderPayload.orderId]
    );
    expect(orderSummary.rows[0].payment_method).toBe('混合支付');
  });

  test('未收取押金办理入住仅生成房费账单', async () => {
    const orderPayload = buildOrderPayload({
      roomTypes: 'you_ge_yuan_zi',
      roomNumber: '113',
      status: 'pending',
      deposit: 0
    });

    await createOrder(orderPayload);
    const orderId = orderPayload.orderId;

    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    // 检查房费账单
    const bills = await query('SELECT change_type, change_price FROM bills WHERE order_id = $1 and change_type = $2', [orderId, '房费']);
    expect(bills.rows.length).toBe(2);
    expect(bills.rows.every(row => row.change_type === '房费')).toBe(true);
    expect(bills.rows.every(row => Number(row.change_price) > 0)).toBe(true);

    // 检查订单状态和押金金额
    const updatedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(updatedOrder.rows[0].status).toBe('checked-in');
    expect(Number(updatedOrder.rows[0].deposit || 0)).toBeCloseTo(0, 5);
  });

  test('订单不存在时返回 404', async () => {
    const response = await request(app)
      .post(`/api/orders/${12345}NOT_FOUND/check-in`)
      .send({ deposit: 100 });

    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('订单不存在');
  });

  test('非待入住状态无法办理入住', async () => {
    const orderPayload = buildOrderPayload({
      roomTypes: 'asu_xiao_zhu',
      roomNumber: '108',
      status: 'checked-in',
      deposit: 100
    });
    await createOrder(orderPayload);
    const orderId = orderPayload.orderId;


    const response = await request(app)
      .post(`/api/orders/${orderId}/check-in`)
      .send({ deposit: 200 });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(`订单状态为 'checked-in'，无法办理入住，只有待入住订单可以办理`);

    // 确认没有生成任何账单，订单状态和押金未变更
    const bills = await query('SELECT COUNT(*) FROM bills WHERE order_id = $1', [orderId]);
    expect(Number(bills.rows[0].count)).toBe(0);

    // 检查订单状态和押金金额未变更
    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [orderId]);
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(100, 5);
  });
});

describe('快速入住接口', () => {

  // beforeAll(async () => {
  //   await addRoomType(roomTypes);
  //   await addRoom(rooms);
  // });

  test('成功快速入住创建订单和账单', async () => {
    const payload = buildOrderPayload({
      orderId: `fast_checkin_Test`,
      guestName: '快速入住客户',
      roomTypes: 'nuan_ju_jiating',
      roomNumber: '310',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-02',
      stayType: '客房',
      deposit: 0,
      status: 'pending'
    });


    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('快速入住成功');

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [payload.orderId]);
    // 检查订单状态
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(payload.deposit, 5);

    // 检查生成的账单
    const storedBills = await query('SELECT change_price,change_type,stay_date FROM bills WHERE order_id = $1 and change_type = \'房费\'', [payload.orderId]);
    expect(storedBills.rows.length).toBe(1);

    // 房间状态为占领
    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [payload.roomNumber]);
    expect(roomStatus.rows[0].status).toBe('occupied');
  });

  test('快速入住休息房', async () => {
    const payload = buildOrderPayload({
      orderId: `fast_checkin_Rest`,
      guestName: '快速入住休息房客户',
      roomTypes: 'you_ge_yuan_zi',
      roomNumber: '113',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-01',
      stayType: '休息房',
      deposit: 50,
      status: 'pending'
    });

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('快速入住成功');

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [payload.orderId]);
    // 检查订单状态
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(payload.deposit, 5);

    // 检查生成的账单
    const storedBills = await query('SELECT change_price,change_type,stay_date FROM bills WHERE order_id = $1 and change_type = \'房费\'', [payload.orderId]);
    expect(storedBills.rows.length).toBe(1);

    // 房间状态为占领
    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [payload.roomNumber]);
    expect(roomStatus.rows[0].status).toBe('occupied');
  });

  test('快速入住多日订单', async () => {
    const payload = buildOrderPayload({
      orderId: `fast_checkin_MultiDay`,
      guestName: '快速入住多日客户',
      roomTypes: 'asu_xiao_zhu',
      roomNumber: '110',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-04',
      roomPrice: {
        "2025-12-01": 150.00,
        "2025-12-02": 180.00,
        "2025-12-03": 200.00
      },
      stayType: '客房',
      deposit: 300,
      status: 'pending'
    });

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('快速入住成功');

    const storedOrder = await query('SELECT status, deposit FROM orders WHERE order_id = $1', [payload.orderId]);
    // 检查订单状态
    expect(storedOrder.rows[0].status).toBe('checked-in');
    expect(Number(storedOrder.rows[0].deposit)).toBeCloseTo(payload.deposit, 5);

    // 检查生成的账单
    const storedBills = await query('SELECT change_price,change_type,stay_date FROM bills WHERE order_id = $1 and change_type = \'房费\' ORDER BY stay_date', [payload.orderId]);
    expect(storedBills.rows.length).toBe(3);
    expect(Number(storedBills.rows[0].change_price)).toBeCloseTo(150, 5);
    expect(Number(storedBills.rows[1].change_price)).toBeCloseTo(180, 5);
    expect(Number(storedBills.rows[2].change_price)).toBeCloseTo(200, 5);


    // 房间状态为占领
    const roomStatus = await query('SELECT status FROM rooms WHERE room_number = $1', [payload.roomNumber]);
    expect(roomStatus.rows[0].status).toBe('occupied');
  });

  test('快速入住支持全单房费拆分支付', async () => {
    const payload = buildOrderPayload({
      orderId: `fast_checkin_split_${Date.now()}`,
      guestName: '快速入住拆分客户',
      roomType: 'asu_xiao_zhu',
      roomNumber: '102',
      checkInDate: '2025-12-20',
      checkOutDate: '2025-12-22',
      roomPrice: {
        '2025-12-20': 150,
        '2025-12-21': 150
      },
      stayType: '客房',
      paymentMethod: '现金',
      deposit: 60,
      roomFeePaymentSplits: [
        { method: '现金', amount: 120 },
        { method: '微信', amount: 180 }
      ],
      depositPaymentSplits: [
        { method: '现金', amount: 20 },
        { method: '微邮付', amount: 40 }
      ],
      status: 'pending'
    });

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    const roomFeeGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '房费'
        GROUP BY pay_way`,
      [payload.orderId]
    );
    const roomFeeMap = Object.fromEntries(
      roomFeeGrouped.rows.map(row => [row.pay_way, Number(row.total)])
    );
    expect(roomFeeMap['现金']).toBeCloseTo(120, 5);
    expect(roomFeeMap['微信']).toBeCloseTo(180, 5);

    const depositGrouped = await query(
      `SELECT pay_way, SUM(change_price) AS total
         FROM bills
        WHERE order_id = $1
          AND change_type = '收押'
        GROUP BY pay_way`,
      [payload.orderId]
    );
    const depositMap = Object.fromEntries(
      depositGrouped.rows.map(row => [row.pay_way, Number(row.total)])
    );
    expect(depositMap['现金']).toBeCloseTo(20, 5);
    expect(depositMap['微邮付']).toBeCloseTo(40, 5);

    const orderSummary = await query(
      'SELECT payment_method FROM orders WHERE order_id = $1 LIMIT 1',
      [payload.orderId]
    );
    expect(orderSummary.rows[0].payment_method).toBe('混合支付');
  });

  test('快速入住支持超过10位房号（防止账单字段长度回归）', async () => {
    // 说明：历史上 bills.room_number 为 VARCHAR(10)，写入 TEST_ROOM_101 会触发 22001。
    // 这个用例用于确保 schema 修复后不会回归。
    const payload = buildOrderPayload({
      orderId: `fast_checkin_LongRoomNumber`,
      guestName: '快速入住长房号客户',
      roomTypes: 'TEST_STD_ROOM',
      roomNumber: 'TEST_ROOM_101',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-02',
      stayType: '客房',
      deposit: 20,
      status: 'pending'
    });

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('快速入住成功');

    // 校验账单确实写入了 room_number，且是长房号。
    const storedBills = await query(
      'SELECT room_number FROM bills WHERE order_id = $1 LIMIT 1',
      [payload.orderId]
    );
    expect(storedBills.rows.length).toBe(1);
    expect(storedBills.rows[0].room_number).toBe(payload.roomNumber);
  });

  test('缺少必填字段时返回 400', async () => {
    const payload = buildOrderPayload({
      orderId: `fast_checkin_MissingField`,
      guestName: '快速入住缺少字段客户',
      // 缺少 roomNumber 字段
      roomTypes: 'nuan_ju_jiating',
      checkInDate: '2025-12-01',
      checkOutDate: '2025-12-02',
      stayType: '客房',
      deposit: 0,
      status: 'pending'
    });
    delete payload.roomNumber; // 明确删除 roomNumber 字段

    const response = await request(app)
      .post('/api/orders/fast-check-in')
      .send(payload);

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('请求参数验证失败');

  });
});
