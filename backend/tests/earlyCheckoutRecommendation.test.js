const request = require('supertest'); // 测试用 HTTP 客户端
const app = require('../app'); // Express 应用实例
const db = require('../database/postgreDB/pg'); // 数据库工具
const { createOrder } = require('../modules/order-create/orderCreate.service'); // 创建订单方法

describe('提前退房建议退款逻辑', () => { // 建议退款逻辑测试套件
  beforeAll(async () => { // 初始化房型与房间
    await db.query( // 插入测试房型
      'INSERT INTO room_types (type_code, type_name, base_price, description, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (type_code) DO NOTHING',
      ['TEST_STD_ROOM', '测试标准房', 100, '建议退款逻辑测试房型', false]
    ); // 房型插入结束
    await db.query( // 插入测试房间
      'INSERT INTO rooms (room_number, type_code, status, price, is_closed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (room_number) DO NOTHING',
      ['TEST_ROOM_101', 'TEST_STD_ROOM', 'available', 100, false]
    ); // 房间插入结束
  }); // beforeAll 结束

  test('按未入住天数的订单 total_price 计算建议退款金额', async () => { // 验证建议退款金额计算规则
    const orderId = `TEST_EC_RECOMMEND_${Date.now()}`; // 生成唯一订单号
    const checkInDate = '2026-01-10'; // 入住日期
    const checkOutDate = '2026-01-12'; // 退房日期
    const orderPayload = { // 订单创建参数
      orderId, // 订单号
      sourceNumber: '', // 渠道订单号
      orderSource: 'front_desk', // 订单来源
      guestName: '建议退款测试客人', // 客人姓名
      roomType: 'TEST_STD_ROOM', // 房型编码
      roomNumber: 'TEST_ROOM_101', // 房间号
      checkInDate, // 入住日期
      checkOutDate, // 退房日期
      status: 'checked-in', // 订单状态
      paymentMethod: '现金', // 支付方式
      phone: '', // 联系电话
      roomPrice: { // 每日房费
        '2026-01-10': 100, // 第一天房费
        '2026-01-11': 120 // 第二天房费
      }, // 每日房费结束
      deposit: 0, // 押金
      isPrepaid: false, // 是否预付
      prepaidAmount: 0, // 预付金额
      stayType: '客房', // 入住类型
      remarks: '建议退款逻辑测试' // 备注
    }; // 订单参数结束

    await createOrder(orderPayload); // 创建订单（不生成房费账单）

    const response = await request(app) // 发起推荐退款请求
      .get(`/api/orders/${orderId}/early-checkout/recommendation`) // 推荐接口
      .query({ actualCheckoutTime: '2026-01-11T09:00', hasStayed: true }); // 传入实际退房时间

    expect(response.statusCode).toBe(200); // 断言接口返回 200
    expect(response.body.success).toBe(true); // 断言接口成功
    expect(response.body.data.refundableNights.length).toBe(1); // 断言可退天数为 1
    expect(response.body.data.refundableNights[0].stayDate).toBe('2026-01-11'); // 断言可退日期
    expect(Number(response.body.data.recommendedRefund).toFixed(2)).toBe('120.00'); // 断言建议退款金额
    expect(response.body.data.originalCheckOutTime).toBe('2026-01-12'); // 断言后端返回原计划退房日
    expect(response.body.data.validation.canEarlyCheckout).toBe(true); // 断言可提前退房校验结果

    await db.query('DELETE FROM bills WHERE order_id = $1', [orderId]); // 清理账单
    await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]); // 清理订单
  }); // 测试用例结束

  test('early checkout recommendation fallback uses order daily rows when room fee bills are missing', async () => { // 兼容缺少账单时使用订单日记录计算
    const orderId = `TEST_EC_RECOMMEND_FALLBACK_${Date.now()}`; // 生成唯一订单号
    const checkInDate = '2026-01-10'; // 入住日期
    const checkOutDate = '2026-01-13'; // 退房日期
    const orderPayload = { // 订单创建参数
      orderId, // 订单号
      sourceNumber: '', // 渠道订单号
      orderSource: 'front_desk', // 订单来源
      guestName: '建议退款回退测试客人', // 客人姓名
      roomType: 'TEST_STD_ROOM', // 房型编码
      roomNumber: 'TEST_ROOM_101', // 房间号
      checkInDate, // 入住日期
      checkOutDate, // 退房日期
      status: 'checked-in', // 订单状态
      paymentMethod: '现金', // 支付方式
      phone: '', // 联系电话
      roomPrice: { // 每日房费
        '2026-01-10': '0.1', // 第一天房费
        '2026-01-11': '0.2', // 第二天房费
        '2026-01-12': '0.3' // 第三天房费
      }, // 每日房费结束
      deposit: 0, // 押金
      isPrepaid: false, // 是否预付
      prepaidAmount: 0, // 预付金额
      stayType: '客房', // 入住类型
      remarks: '建议退款回退逻辑测试' // 备注
    }; // 订单参数结束

    await createOrder(orderPayload); // 创建订单（不生成房费账单）

    const response = await request(app) // 发起推荐退款请求
      .get(`/api/orders/${orderId}/early-checkout/recommendation`) // 推荐接口
      .query({ hasStayed: false }); // 未入住直接退房场景

    expect(response.statusCode).toBe(200); // 断言接口返回 200
    expect(response.body.success).toBe(true); // 断言接口成功
    expect(response.body.data.refundableNights.length).toBe(3); // 断言可退天数为 3
    expect(Number(response.body.data.recommendedRefund).toFixed(2)).toBe('0.60'); // 断言建议退款金额精度
    expect(response.body.data.validation.canEarlyCheckout).toBe(true); // 未入住退房默认允许
    expect(response.body.data.actualCheckoutDate).toBe(''); // 未入住场景不要求实际退房日期

    await db.query('DELETE FROM bills WHERE order_id = $1', [orderId]); // 清理账单
    await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]); // 清理订单
  }); // 测试用例结束

  test('当实际退房日不早于原退房日时，返回不可提前退房标记', async () => {
    const orderId = `TEST_EC_RECOMMEND_NOT_EARLY_${Date.now()}`; // 生成唯一订单号
    const orderPayload = { // 创建两晚订单
      orderId,
      sourceNumber: '',
      orderSource: 'front_desk',
      guestName: '建议退款非提前测试客人',
      roomType: 'TEST_STD_ROOM',
      roomNumber: 'TEST_ROOM_101',
      checkInDate: '2026-01-10',
      checkOutDate: '2026-01-12',
      status: 'checked-in',
      paymentMethod: '现金',
      phone: '',
      roomPrice: {
        '2026-01-10': 100,
        '2026-01-11': 120
      },
      deposit: 0,
      isPrepaid: false,
      prepaidAmount: 0,
      stayType: '客房',
      remarks: '建议退款非提前测试'
    };

    await createOrder(orderPayload); // 创建订单

    const response = await request(app)
      .get(`/api/orders/${orderId}/early-checkout/recommendation`)
      .query({ actualCheckoutTime: '2026-01-12T09:00', hasStayed: true }); // 实际退房日等于原退房日

    expect(response.statusCode).toBe(200); // 推荐接口仍返回 200，由前端根据 validation 禁用提交
    expect(response.body.success).toBe(true);
    expect(response.body.data.validation.canEarlyCheckout).toBe(false);
    expect(response.body.data.validation.code).toBe('NOT_EARLY');

    await db.query('DELETE FROM bills WHERE order_id = $1', [orderId]); // 清理账单
    await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]); // 清理订单
  });
}); // describe 结束
