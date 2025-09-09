// 交接班扩展示例：不同支付方式、休息房、多日订单
const request = require('supertest');
const app = require('../../app');
const { createTestRoomType, createTestRoom, createTestOrder, generatePriceData } = require('../test-helpers');
const { query } = require('../../backend/database/postgreDB/pg');

describe('交接班 - 支付方式/休息房/多日订单 场景', () => {
  beforeEach(global.cleanupTestData);

  // 帮助函数：汇总对象数值
  const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);

  it('不同支付方式的客房收入应分别聚合到各自的支付键上', async () => {
    const rt = await createTestRoomType({ type_code: 'RT_PAYWAYS' });
    const rooms = [];
    for (let i = 0; i < 4; i++) {
      rooms.push(await createTestRoom(rt.type_code));
    }

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    // 4单：不同支付方式
    const orders = [];
    const pm = ['cash', 'wechat', 'alipay', 'platform'];
    const prices = [100, 110, 120, 130];
    for (let i = 0; i < 4; i++) {
      orders.push(await createTestOrder({
        room_type: rt.type_code,
        room_number: rooms[i].room_number,
        check_in_date: todayStr,
        check_out_date: tomorrowStr,
        status: 'pending',
        payment_method: pm[i],
        room_price: { [todayStr]: prices[i] },
        deposit: 200
      }, { insert: true }));
    }

    // 状态更新、stay_type 设置
    for (const o of orders) {
      await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
    }

    const res = await request(app).get('/api/shift-handover/table').query({ date: todayStr });
    expect(res.status).toBe(200);
    expect(res.body && res.body.success).toBe(true);
    const data = res.body.data || {};

    // 校验各支付方式下的客房收入（首日=押金+房费）
    expect((data.hotelIncome || {})['cash']).toBeCloseTo(200 + 100, 2);
    expect((data.hotelIncome || {})['wechat']).toBeCloseTo(200 + 110, 2);
    expect((data.hotelIncome || {})['alipay']).toBeCloseTo(200 + 120, 2);
    expect((data.hotelIncome || {})['platform']).toBeCloseTo(200 + 130, 2);

    // 校验总和=各支付方式之和
    const totalIncome = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
    expect(totalIncome).toBeCloseTo((200 + 100) + (200 + 110) + (200 + 120) + (200 + 130), 2);
  });

  it('休息房在当日应计入restIncome（押金+房费），并按支付方式拆分', async () => {
    const rt = await createTestRoomType({ type_code: 'RT_REST' });
    const rooms = [];
    for (let i = 0; i < 3; i++) {
      rooms.push(await createTestRoom(rt.type_code));
    }

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 休息房：同日入退
    const orders = [];
    const restDefs = [
      { pay: 'cash', deposit: 50, fee: 40 },
      { pay: 'wechat', deposit: 60, fee: 50 },
      { pay: 'alipay', deposit: 70, fee: 0 },
    ];
    for (let i = 0; i < restDefs.length; i++) {
      const def = restDefs[i];
      orders.push(await createTestOrder({
        room_type: rt.type_code,
        room_number: rooms[i].room_number,
        check_in_date: todayStr,
        check_out_date: todayStr, // 同日
        status: 'pending',
        payment_method: def.pay,
        room_price: { [todayStr]: def.fee },
        deposit: def.deposit
      }, { insert: true }));
    }

    for (const o of orders) {
      await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET stay_type='休息房' WHERE order_id=$1`, [o.order_id]);
    }

    const res = await request(app).get('/api/shift-handover/table').query({ date: todayStr });
    expect(res.status).toBe(200);
    expect(res.body && res.body.success).toBe(true);
    const data = res.body.data || {};

    // 校验各支付方式
    expect((data.restIncome || {})['cash']).toBeCloseTo(50 + 40, 2);
    expect((data.restIncome || {})['wechat']).toBeCloseTo(60 + 50, 2);
    expect((data.restIncome || {})['alipay']).toBeCloseTo(70 + 0, 2);

    // 酒店收入应为0（仅创建了休息房）
    expect(sumObj(data.hotelIncome)).toBeCloseTo(0, 2);
  });

  it('多日订单：首日计押金+房费，其余日仅计房费；退押在退房日统计', async () => {
    const rt = await createTestRoomType({ type_code: 'RT_MULTI' });
    const room = await createTestRoom(rt.type_code);

    const base = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = base.getFullYear();
    const mm = pad(base.getMonth() + 1);
    const dd = pad(base.getDate());
    const d0 = `${yyyy}-${mm}-${dd}`;
    const d1d = new Date(base); d1d.setDate(base.getDate() + 1); const d1 = `${d1d.getFullYear()}-${pad(d1d.getMonth() + 1)}-${pad(d1d.getDate())}`;
    const d2d = new Date(base); d2d.setDate(base.getDate() + 2); const d2 = `${d2d.getFullYear()}-${pad(d2d.getMonth() + 1)}-${pad(d2d.getDate())}`;
    const d3d = new Date(base); d3d.setDate(base.getDate() + 3); const d3 = `${d3d.getFullYear()}-${pad(d3d.getMonth() + 1)}-${pad(d3d.getDate())}`;

    // 3晚：d0, d1, d2；退房日为 d3
    const price = { [d0]: 100, [d1]: 110, [d2]: 120 };
    const order = await createTestOrder({
      room_type: rt.type_code,
      room_number: room.room_number,
      check_in_date: d0,
      check_out_date: d3,
      status: 'pending',
      payment_method: 'cash',
      room_price: price,
      deposit: 200
    }, { insert: true });

    await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [order.order_id]);
    await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [order.order_id]);
    await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [order.order_id]);

    // d0: 押金+房费
    let r0 = await request(app).get('/api/shift-handover/table').query({ date: d0 });
    expect(r0.status).toBe(200);
    const data0 = r0.body.data || {};
    expect((data0.hotelIncome || {})['cash']).toBeCloseTo(200 + 100, 2);

    // d1: 仅房费110
    let r1 = await request(app).get('/api/shift-handover/table').query({ date: d1 });
    expect(r1.status).toBe(200);
    const data1 = r1.body.data || {};
    expect((data1.hotelIncome || {})['cash']).toBeCloseTo(110, 2);

    // d2: 仅房费120
    let r2 = await request(app).get('/api/shift-handover/table').query({ date: d2 });
    expect(r2.status).toBe(200);
    const data2 = r2.body.data || {};
    expect((data2.hotelIncome || {})['cash']).toBeCloseTo(120, 2);

    // 退押在退房日(d3)
    const refundTimeLocal = `${d3}T12:00:00`;
    const refundRes = await request(app)
      .post(`/api/orders/${order.order_id}/refund-deposit`)
      .send({ order_id: order.order_id, change_price: 150, method: 'cash', refundTime: refundTimeLocal });
    expect(refundRes.status).toBe(200);

    let r3 = await request(app).get('/api/shift-handover/table').query({ date: d3 });
    expect(r3.status).toBe(200);
    const data3 = r3.body.data || {};
    // d3 不再计入住收入（date < check_out_date），仅应统计退押
    expect(sumObj(data3.hotelIncome)).toBeCloseTo(0, 2);
    expect((data3.hotelRefund || {})['cash']).toBeCloseTo(150, 2);
  });
});
