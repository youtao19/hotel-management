const request = require('supertest');
const app = require('../app');
const { query } = require('../database/postgreDB/pg');
const {
  roomTypes,
  rooms,
  buildOrderPayload,
  addRoomType,
  addRoom
} = require('./tools');
const { createOrder } = require('../modules/orderModule');

const TEST_PREFIX = 'DAILY_ROOM_CASE_';

// 将日期字段格式化为 YYYY-MM-DD（使用本地时区，避免 UTC 被截断成前一天）
const toYmd = (value) => {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(value).slice(0, 10);
};

// 统一获取每日安排并过滤本测试写入的数据
const fetchDailyRows = async () => {
  const response = await request(app).get('/api/orders/daily');
  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.body.data)).toBe(true);
  return response.body.data.filter(row => row.order_id.startsWith(TEST_PREFIX));
};

const clearTestOrders = async () => {
  await query('DELETE FROM orders WHERE order_id LIKE $1', [`${TEST_PREFIX}%`]);
};

describe('每日房间安排 API - 更换房间场景', () => {
  beforeAll(async () => {
    // 使用 tools 中的房型与房间数据初始化
    await addRoomType(roomTypes);
    await addRoom(rooms);
  });

  afterEach(async () => {
    await clearTestOrders();
  });

  afterAll(async () => {
    await clearTestOrders();
  });

  test('单日订单更换房间成功', async () => {
    const orderId = `${TEST_PREFIX}SINGLE`;
    const orderPayload = buildOrderPayload({
      orderId,
      roomType: 'TEST_STD_ROOM',
      roomNumber: 'TEST_ROOM_101',
      checkInDate: '2025-10-20',
      checkOutDate: '2025-10-21',
      roomPrice: { '2025-10-20': 188.0 },
      stayType: '客房',
    });
    await createOrder(orderPayload);

    const res = await request(app)
      .put(`/api/orders/${orderId}/day-room`)
      .send({ stayDate: '2025-10-20', newRoomNumber: '117' }); // 117: you_ge_yuan_zi

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await fetchDailyRows();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(toYmd(row.stay_date)).toBe('2025-10-20');
    expect(row.room_number).toBe('117');
    expect(row.room_type).toBe('you_ge_yuan_zi'); // 跨房型更换
    expect(toYmd(row.check_in_date)).toBe('2025-10-20');
    expect(toYmd(row.check_out_date)).toBe('2025-10-21');
  });

  test('休息房同日更换房间成功', async () => {
    const orderId = `${TEST_PREFIX}REST`;
    const orderPayload = buildOrderPayload({
      orderId,
      roomType: 'yi_jiang_nan',
      roomNumber: '205',
      checkInDate: '2025-10-30',
      checkOutDate: '2025-10-30',
      roomPrice: { '2025-10-30': 120.0 },
      stayType: '休息房',
    });
    await createOrder(orderPayload);

    const res = await request(app)
      .put(`/api/orders/${orderId}/day-room`)
      .send({ stayDate: '2025-10-30', newRoomNumber: '102' }); // 102: asu_xiao_zhu，跨房型更换

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await fetchDailyRows();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(toYmd(row.stay_date)).toBe('2025-10-30');
    expect(row.room_number).toBe('102');
    expect(row.room_type).toBe('asu_xiao_zhu');
    expect(toYmd(row.check_in_date)).toBe('2025-10-30');
    expect(toYmd(row.check_out_date)).toBe('2025-10-30');
    expect(row.stay_type).toBe('休息房');
  });

  test('多日订单逐天更换房间成功', async () => {
    const orderId = `${TEST_PREFIX}MULTI`;
    const orderPayload = buildOrderPayload({
      orderId,
      roomType: 'you_ge_yuan_zi',
      roomNumber: '115',
      checkInDate: '2025-10-22',
      checkOutDate: '2025-10-25',
      roomPrice: {
        '2025-10-22': 388.0,
        '2025-10-23': 388.0,
        '2025-10-24': 408.5,
      },
      stayType: '客房',
    });
    await createOrder(orderPayload);

    const changes = [
      { stayDate: '2025-10-22', newRoomNumber: '117' }, // you_ge_yuan_zi
      { stayDate: '2025-10-23', newRoomNumber: '203' }, // sheng_sheng_man
      { stayDate: '2025-10-24', newRoomNumber: '305' }, // yi_jiang_nan
    ];

    for (const { stayDate, newRoomNumber } of changes) {
      const res = await request(app)
        .put(`/api/orders/${orderId}/day-room`)
        .send({ stayDate, newRoomNumber });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    }

    const rows = await fetchDailyRows();
    expect(rows.length).toBe(3);
    const map = rows.reduce((acc, row) => {
      acc[toYmd(row.stay_date)] = {
        room_number: row.room_number,
        room_type: row.room_type
      };
      return acc;
    }, {});

    expect(map).toEqual({
      '2025-10-22': { room_number: '117', room_type: 'you_ge_yuan_zi' },
      '2025-10-23': { room_number: '203', room_type: 'sheng_sheng_man' },
      '2025-10-24': { room_number: '305', room_type: 'yi_jiang_nan' },
    });
  });

  test('更换至其他房型成功', async () => {
    const orderId = `${TEST_PREFIX}CROSS_TYPE`;
    const orderPayload = buildOrderPayload({
      orderId,
      roomType: 'bo_ye_shuang',
      roomNumber: '202',
      checkInDate: '2025-11-05',
      checkOutDate: '2025-11-06',
      roomPrice: { '2025-11-05': 258.0 },
      stayType: '客房',
    });
    await createOrder(orderPayload);

    // 将房型从 bo_ye_shuang 切换到 yun_ju_ying_yin（房间 401）
    const res = await request(app)
      .put(`/api/orders/${orderId}/day-room`)
      .send({ stayDate: '2025-11-05', newRoomNumber: '401' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await fetchDailyRows();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(toYmd(row.stay_date)).toBe('2025-11-05');
    expect(row.room_number).toBe('401');
    expect(row.room_type).toBe('yun_ju_ying_yin'); // 新房型应被带回
  });
});
