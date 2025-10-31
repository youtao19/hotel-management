const request = require('supertest');
const app = require('../../app');
const { addRoom, addRoomType, rooms, roomTypes, ORDERS, createOrder } = require('../tools');
const db = require('../../database/postgreDB/pg');

const TEST_DATE = '2025-10-25';

const handoverData1 ={
  date: TEST_DATE,
  handover_person: 'Alice',
  takeover_person: 'Bob',
  vip_card: 10,
  payment_type: 1,
  reserve_cash: 500,
  room_income: 2000,
  rest_income: 300,
  rent_income: 150,
  total_income: 2450,
  room_refund: 0,
  rest_refund: 0,
  retained: 320,
  handover: 2120,
  task_list: '[]',
  remarks: ''
}
const handoverData2 ={
  date: TEST_DATE,
  handover_person: 'Alice',
  takeover_person: 'Bob',
  vip_card: 10,
  payment_type: 2,
  reserve_cash: 500,
  room_income: 2000,
  rest_income: 300,
  rent_income: 150,
  total_income: 2450,
  room_refund: 0,
  rest_refund: 0,
  retained: 320,
  handover: 2120,
  task_list: '[]',
  remarks: ''
}

const handoverData3 ={
  date: TEST_DATE,
  handover_person: 'Alice',
  takeover_person: 'Bob',
  vip_card: 10,
  payment_type: 3,
  reserve_cash: 500,
  room_income: 2000,
  rest_income: 300,
  rent_income: 150,
  total_income: 2450,
  room_refund: 0,
  rest_refund: 0,
  retained: 320,
  handover: 2120,
  task_list: '[]',
  remarks: ''
}

const handoverData4 ={
  date: TEST_DATE,
  handover_person: 'Alice',
  takeover_person: 'Bob',
  vip_card: 10,
  payment_type: 4,
  reserve_cash: 500,
  room_income: 2000,
  rest_income: 300,
  rent_income: 150,
  total_income: 2450,
  room_refund: 0,
  rest_refund: 0,
  retained: 320,
  handover: 2120,
  task_list: '[]',
  remarks: ''
}

async function createHandoverData(handoverData) {
  const sql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, vip_card, payment_type,
          reserve_cash, room_income, rest_income, rent_income, total_income,
          room_refund, rest_refund, retained, handover, task_list, remarks
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (date, payment_type) DO UPDATE SET
          handover_person = EXCLUDED.handover_person,
          takeover_person = EXCLUDED.takeover_person,
          vip_card = EXCLUDED.vip_card,
          reserve_cash = EXCLUDED.reserve_cash,
          room_income = EXCLUDED.room_income,
          rest_income = EXCLUDED.rest_income,
          rent_income = EXCLUDED.rent_income,
          total_income = EXCLUDED.total_income,
          room_refund = EXCLUDED.room_refund,
          rest_refund = EXCLUDED.rest_refund,
          retained = EXCLUDED.retained,
          handover = EXCLUDED.handover,
          task_list = EXCLUDED.task_list,
          remarks = EXCLUDED.remarks
        RETURNING *;
      `;
  const values = [
    handoverData.date,
    handoverData.handover_person,
    handoverData.takeover_person,
    handoverData.vip_card,
    handoverData.payment_type,
    handoverData.reserve_cash,
    handoverData.room_income,
    handoverData.rest_income,
    handoverData.rent_income,
    handoverData.total_income,
    handoverData.room_refund,
    handoverData.rest_refund,
    handoverData.retained,
    handoverData.handover,
    handoverData.task_list,
    handoverData.remarks
  ];
  const result =  await db.query(sql, values);
  return result.rows[0];
}

describe('交接班集成测试',() => {
  beforeAll(async () => {
    // 添加房型
    await addRoomType(roomTypes);
    // 添加房间
    await addRoom(rooms);
    // 添加订单并入住
    for (const order of ORDERS) {
      await request(app)
        .post('/api/orders/new')
        .send(order);

      // 办理入住
      await request(app).post(`/api/orders/${order.id}/check-in`)
        .send({ deposit: order.deposit, dailyPrices: order.dailyPrices });
    }

    await db.query('DELETE FROM handover');
  });

  beforeEach(async () => {
    await db.query('DELETE FROM handover');
  });

  afterAll(async () => {
    await db.query('DELETE FROM handover');
  });

  test('test function', async () => {
    await createHandoverData(handoverData1);
    const res = await db.query(
      'SELECT * FROM handover WHERE date=$1 AND payment_type=$2',
      [handoverData1.date, handoverData1.payment_type]
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].handover_person).toBe('Alice');
  })

  describe('步骤一：检查昨日交接班记录', () => {
    test('无交接记录', async () => {
      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: TEST_DATE });

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toMatchObject({
        date: TEST_DATE,
        hasRecord: false,
        isComplete: false
      });
      expect(res.body.message).toBe('无交接记录');
    });

    test('交接记录不完整', async () => {
      // 模拟添加不完整的交接班记录
      await createHandoverData(handoverData1);

      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: TEST_DATE });

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        date: TEST_DATE,
        hasRecord: true,
        isComplete: false,
        paymentCount: 1
      });
      expect(res.body.data.paymentTypes).toEqual([1]);
      expect(res.body.message).toBe('交接记录不完整');

    });

    test('已完成交接', async () => {
      // 模拟添加完整的交接班记录
      await createHandoverData(handoverData1);
      await createHandoverData(handoverData2);
      await createHandoverData(handoverData3);
      await createHandoverData(handoverData4);

      const res = await request(app)
        .get('/api/handover/check-yesterday')
        .query({ date: TEST_DATE });

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        date: TEST_DATE,
        hasRecord: true,
        isComplete: true,
        paymentCount: 4
      });
      expect(res.body.data.paymentTypes).toEqual([1, 2, 3, 4]);
      expect(res.body.message).toBe('已完成交接');
    })

  });


  describe('步骤三: 核对交接数据', () => {

    test('获取交接数据', async () => {
      const res = await request(app)
        .get(`/api/bills/by-date/${TEST_DATE}`);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.message).toBe(`成功获取 ${TEST_DATE} 的账单数据`);
    });
    
  });




});
