const { query } = require('../database/postgreDB/pg');
const request = require('supertest');
const app = require('../app');

/**
 * 创建一个唯一的测试ID后缀，以确保测试数据的隔离性
 * @returns {string}
 */
const createUniqueSuffix = () => {
  // Use a longer suffix to ensure better uniqueness
  return Math.random().toString(36).substr(2, 12); // 12 characters
};

/**
 * 创建一个测试房型
 * @param {object} overrides - 覆盖默认值的对象
 * @returns {Promise<object>} 创建的房型对象
 */
async function createTestRoomType(overrides = {}) {
  const suffix = createUniqueSuffix();
  const defaults = {
    type_code: `T_${suffix}`.slice(0, 20), // Ensure it fits VARCHAR(20)
    type_name: `测试房型_${suffix}`,
    base_price: '288.00',
    description: '这是一个测试房型',
    is_closed: false,
  };
  const roomTypeData = { ...defaults, ...overrides };
  // Ensure provided overrides.type_code also fits the DB column width
  if (roomTypeData.type_code) {
    roomTypeData.type_code = String(roomTypeData.type_code).slice(0, 20);
  }

  await query(
  `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (type_code) DO UPDATE SET type_name = EXCLUDED.type_name, base_price = EXCLUDED.base_price, description = EXCLUDED.description, is_closed = EXCLUDED.is_closed`,
  [roomTypeData.type_code, roomTypeData.type_name, roomTypeData.base_price, roomTypeData.description, roomTypeData.is_closed]
  );

  return roomTypeData;
}

/**
 * 创建一个测试房间
 * @param {string} typeCode - 房型代码
 * @param {object} overrides - 覆盖默认值的对象
 * @returns {Promise<object>} 创建的房间对象
 */
async function createTestRoom(typeCode, overrides = {}) {
  const suffix = createUniqueSuffix();
  const idResult = await query('SELECT MAX(room_id) as max_id FROM rooms');
  const nextId = (idResult.rows[0].max_id || 0) + 1;

  const defaults = {
    room_id: nextId,
    room_number: `R_${suffix}`.slice(0, 20), // Ensure it fits VARCHAR(20)
    status: 'available',
    price: '288.00',
    is_closed: false,
  };
  const roomData = { ...defaults, ...overrides, type_code: typeCode };

  // Ensure overridden room_number fits the DB column width
  if (roomData.room_number) {
    // 如果提供的房间号没有 'R_' 前缀，为了测试数据清理的一致性，添加前缀
    if (!String(roomData.room_number).startsWith('R_')) {
      roomData.room_number = `R_${roomData.room_number}`;
    }
    roomData.room_number = String(roomData.room_number).slice(0, 20);
  }

  await query(
    `INSERT INTO rooms (room_id, room_number, type_code, status, price, is_closed)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [roomData.room_id, roomData.room_number, roomData.type_code, roomData.status, roomData.price, roomData.is_closed]
  );

  return roomData;
}

/**
 * 为订单生成价格JSON
 * @param {string} checkInDate - 入住日期
 * @param {string} checkOutDate - 退房日期
 * @param {number} dailyPrice - 每日价格
 * @returns {object}
 */
function generatePriceData(checkInDate, checkOutDate, dailyPrice = 200.00) {
  const startDate = new Date(checkInDate);
  const endDate = new Date(checkOutDate);
  const priceData = {};
  let currentDate = new Date(startDate);

  // 循环直到当前日期达到退房日期
  while (currentDate < endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    priceData[dateKey] = dailyPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 如果是当天入住退房（休息房），确保至少有一天的价格
  if (startDate.getTime() === endDate.getTime()) {
      const dateKey = startDate.toISOString().split('T')[0];
      priceData[dateKey] = dailyPrice;
  }

  return priceData;
}

/**
 * 创建一个测试订单
 * @param {object} overrides - 覆盖默认值的对象
 * @returns {Promise<object>} 创建的订单对象
 */
async function createTestOrder(overrides = {}, options = { insert: false }) {
  const suffix = createUniqueSuffix();
  const checkInDate = new Date();
  const checkOutDate = new Date();
  checkOutDate.setDate(checkInDate.getDate() + 1);

  const defaults = {
    order_id: `ORDER_${suffix}`.slice(0, 20),
    order_source: 'front_desk',
    guest_name: `测试客人_${suffix}`,
    id_number: `123456789012345678`,
    phone: `13800138000`, // Fixed valid phone number
    check_in_date: checkInDate.toISOString().split('T')[0],
    check_out_date: checkOutDate.toISOString().split('T')[0],
    status: 'pending',
    payment_method: 'cash',
    deposit: '100.00',
    remarks: '自动生成的测试订单',
  };

  const orderData = { ...defaults, ...overrides };

  // Ensure room type and room exist
  if (!orderData.room_type || !orderData.room_number) {
    console.error('Debug: room_type or room_number missing', { room_type: orderData.room_type, room_number: orderData.room_number });
    throw new Error('创建订单需要 room_type 和 room_number');
  }

  // Handle room_price to total_price conversion
  if (overrides.room_price !== undefined) {
    if (typeof overrides.room_price === 'object' && overrides.room_price !== null) {
      // If room_price is an object (date-price mapping), convert to total_price object format
      orderData.total_price = overrides.room_price;
    } else {
      // If room_price is a number, use it directly
      orderData.total_price = overrides.room_price;
    }
    delete orderData.room_price; // Remove room_price as it's not a valid field for the API
  }

  // Auto-generate price if not provided
  if (orderData.total_price === undefined) {
    const priceData = generatePriceData(orderData.check_in_date, orderData.check_out_date, 250.00);
    orderData.total_price = Object.values(priceData).reduce((sum, price) => sum + price, 0);
  }

  // 如果 options.insert 为 true，则直接将订单插入测试数据库（用于依赖 DB 状态的测试）
  if (options && options.insert) {
    // 对于数据库插入，需要将 total_price 对象转换为数字
    let dbTotalPrice = orderData.total_price;
    if (typeof dbTotalPrice === 'object' && dbTotalPrice !== null) {
      dbTotalPrice = Object.values(dbTotalPrice).reduce((sum, price) => sum + price, 0);
    }

    const values = [
      orderData.order_id,
      orderData.id_source,
      orderData.order_source,
      orderData.guest_name,
      orderData.phone,
      orderData.id_number,
      orderData.room_type,
      orderData.room_number,
      orderData.check_in_date,
      orderData.check_out_date,
      orderData.status,
      orderData.payment_method,
      dbTotalPrice,
      orderData.deposit,
      new Date(),
      orderData.remarks
    ];

    await query(
      `INSERT INTO orders (
         order_id, id_source, order_source, guest_name, phone, id_number,
         room_type, room_number, check_in_date, check_out_date, status,
         payment_method, total_price, deposit, create_time, remarks
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      values
    );
  }

  // 返回构造好的订单数据供测试用例使用
  return orderData;
}

/**
 * 创建一个测试账单
 * @param {string} orderId - 订单ID
 * @param {object} overrides - 覆盖默认值的对象
 * @returns {Promise<object>} 创建的账单对象
 */
async function createTestBill(orderId, overrides = {}) {
    const suffix = createUniqueSuffix();
    const defaults = {
        room_number: `BILL_R_${suffix}`.slice(0, 20),
        guest_name: `测试客人_${suffix}`,
        deposit: '200.00',
        refund_deposit: 'yes',
        room_fee: '500.00',
        total_income: '700.00',
        pay_way: { value: 'cash' },
        remarks: '自动生成的测试账单'
    };

    const billData = { ...defaults, ...overrides, order_id: orderId };

  const response = await request(app)
    .post('/api/bills/new')
        .send(billData);

    if (response.status !== 201) {
        console.error('Test Helper Error creating bill:', response.body);
        throw new Error(`创建测试账单失败: ${response.status} - ${response.body.message}`);
    }

    return billData;
}


module.exports = {
  createTestRoomType,
  createTestRoom,
  createTestOrder,
  createTestBill,
  generatePriceData,
};
