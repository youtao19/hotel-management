const express = require('express');
const router = express.Router();
router.use(express.json());
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication');
const { query, getClient } = require('../database/postgreDB/pg');
const setup = require('../appSettings/setup');
const { formatDate } = require('../modules/tools');
const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'reserved', 'checked-in', 'checked-out', 'occupied', 'cancelled'];


const createOrderSchema = {
  type: 'object',
  properties: {
    order_id: { type: 'string' },
    id_source: { type: 'string' },
    order_source: { type: 'string' },
    guest_name: { type: 'string' },
    room_type: { type: 'string' },
    room_number: { type: 'string' },
    check_in_date: { type: 'string', format: 'date' },
    check_out_date: { type: 'string', format: 'date' },
    status: { type: 'string', enum: VALID_ORDER_STATES },
    payment_method: { type: 'string' },
    phone: {
      type: 'string',
      pattern: '^$|^1[3-9]\\d{9}$'
     },
    total_price: {
      type: 'object',
      minProperties: 1,
      propertyNames: { type: 'string', format: 'date' },
      additionalProperties: {
        anyOf: [
          { type: 'number', exclusiveMinimum: 0 },
          { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d+)?$', not: { const: '0' } }
        ]
      }
    },
    deposit: { type: 'number' },
    stay_type: { type: 'string' , enum: ['客房', '休息房'] },
    create_time: { type: 'string', format: 'date-time' },
    remarks: { type: 'string' }
  },
  required: ['order_id', 'order_source', 'guest_name', 'room_type', 'room_number', 'check_in_date', 'check_out_date', 'status', 'payment_method', 'total_price'],
  additionalProperties: false
};

const updateOrderStatusSchema = {
  type: 'object',
  properties: {
    newStatus: { type: 'string', enum: VALID_ORDER_STATES },
    checkInTime: { type: 'string', format: 'date-time' },
    checkOutTime: { type: 'string', format: 'date-time' }
  },
  required: ['newStatus'],
  additionalProperties: false
};


/**
 * 获取所有订单
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    console.log('获取所有订单请求');
    if (process.env.NODE_ENV === 'dev' && req.query?.debug === '1') {
      try {
        const tableCheck = await orderModule.checkTableExists();
        if (!tableCheck.rows[0].exists) {
          console.log('orders表不存在！');
        }
      } catch (e) {
        console.warn('检查orders表存在失败(忽略):', e.message);
      }
    }
    const orders = await orderModule.getAllOrders();
    console.log(`成功获取 ${orders.length} 条订单数据`);
    res.status(200).json({ data: orders });
  } catch (err) {
    console.error('获取订单数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

/**
 * 获取特定ID的订单
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`获取订单ID: ${id}`);

    const order = await orderModule.getOrderById(id);

    if (!order) {
      return res.status(404).json({ message: '未找到订单' });
    }

    res.json({ data: order });
  } catch (err) {
    console.error('获取订单数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

/**
 * 创建新订单
 * POST /api/orders/new
 */
router.post('/new', async (req, res) => {
  console.log('收到订单创建请求，请求体:', JSON.stringify(req.body, null, 2));

  // 请求参数验证
  const validate = ajv.compile(createOrderSchema);
  const valid = validate(req.body);
  if (!valid) {
    console.error('订单创建请求参数验证失败:', validate.errors);
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validate.errors
    });
  }

  try {
    const newOrder = await orderModule.createOrder(req.body);

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: {
        order: newOrder
      }
    });

  } catch (error) {
  console.error('创建订单失败(路由层):', error.code || 'NO_CODE', error.message);

    // 处理不同类型的错误
    switch(error.code) {
      case 'DUPLICATE_ORDER':
        return res.status(409).json({
          success: false,
          message: '相同订单已存在',
          data: {
            existingOrder: error.existingOrder
          }
        });

      case 'MISSING_REQUIRED_FIELDS':
      case 'INVALID_ORDER_STATUS':
      case 'INVALID_DATE_FORMAT':
      case 'INVALID_DATE_RANGE':
      case 'INVALID_PHONE_FORMAT':
      case 'INVALID_PRICE':
      case 'INVALID_PRICE_EMPTY':
      case 'INVALID_PRICE_JSON':
      case 'INVALID_PRICE_DATE_FORMAT':
      case 'INVALID_PRICE_DATE_RANGE':
      case 'INVALID_DEPOSIT':
  case 'INVALID_STAY_TYPE':
      case 'INVALID_ROOM_TYPE':
      case 'INVALID_ROOM_NUMBER':
      case 'ROOM_CLOSED':
      case 'ROOM_ALREADY_BOOKED':
        return res.status(400).json({
          success: false,
          message: error.message,
          error: {
            code: error.code,
            details: error.message
          }
        });

      case '23505': // 数据库唯一约束冲突
        return res.status(409).json({
          success: false,
          message: '订单创建失败：数据重复',
          error: error.message
        });

      case '23503': // 外键约束冲突
        return res.status(400).json({
          success: false,
          message: '订单创建失败：无效的关联数据',
          error: error.message
        });

      default:
        return res.status(500).json({
          success: false,
          message: '订单创建失败',
          error: { code: error.code || 'UNKNOWN', details: error.message }
        });
    }
  }
});

/**
 * 快速入住：创建已入住订单和账单（使用事务）
 * POST /api/orders/fast-check-in
 */
router.post('/fast-check-in', async (req, res) => {
  try {
    // 验证请求数据
    const validate = ajv.compile(createOrderSchema);
    const valid = validate(req.body);
    if (!valid) {
      console.error('快速入住请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const orderData = req.body;
    const depositAmount = parseFloat(req.body.deposit) || 0;

    console.log('🚀 收到快速入住请求:', {
      order_id: orderData.order_id,
      guest_name: orderData.guest_name,
      room_number: orderData.room_number,
      deposit: depositAmount
    });

    // 调用业务逻辑函数
    const result = await orderModule.createCheckedInOrderWithTransaction(orderData, depositAmount);

    console.log('✅ 快速入住成功:', result.order.order_id);

    return res.status(200).json({
      success: true,
      message: '快速入住成功',
      data: result
    });

  } catch (error) {
    console.error('❌ 快速入住失败:', error);
    return res.status(500).json({
      success: false,
      message: '快速入住失败',
      error: error.message
    });
  }
});

/**
 * 更新订单状态
 * POST /api/orders/:/status
 */
router.post('/:orderNumber/status', async (req, res) => {

    // 请求参数验证
    const validate = ajv.compile(updateOrderStatusSchema);
    const valid = validate(req.body);
    if (!valid) {
      console.error('更新订单状态请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const { orderNumber } = req.params;
    const { newStatus, checkInTime, checkOutTime } = req.body;

    try {
        const updatedOrder = await orderModule.updateOrderStatus(orderNumber, newStatus, { checkInTime, checkOutTime });
        if (!updatedOrder) {
            return res.status(404).json({ message: '未找到订单或更新失败' });
        }
        res.json({ message: '订单状态更新成功', order: updatedOrder });
    } catch (error) {
        console.error(`更新订单 ${orderNumber} 状态为 ${newStatus} 失败:`, error);
        res.status(500).json({ message: '更新订单状态失败', error: error.message });
    }
});

/**
 * 更新订单
 * PUT /api/orders/:orderNumber
 */
router.put('/:orderNumber', authenticationMiddleware, async (req, res) => {
    const { orderNumber } = req.params;
    const updatedFields = req.body;

    try {
        const updatedOrder = await orderModule.updateOrder(orderNumber, updatedFields);
        res.json({ success: true, message: '订单更新成功', data: updatedOrder });
    } catch (error) {
        console.error(`更新订单 ${orderNumber} 失败:`, error);
        res.status(500).json({ success: false, message: '更新订单失败', error: error.message });
    }
});

/**
 * 更新订单和相关账单（联合事务）
 * PUT /api/orders/:orderNumber/with-bills
 */
router.put('/:orderNumber/with-bills', authenticationMiddleware, async (req, res) => {
    const { orderNumber } = req.params;
    const { orderData, billUpdates, changedBy } = req.body;

    try {
        const result = await orderModule.updateOrderWithBills(orderNumber, orderData, billUpdates, changedBy);
        res.json(result);
    } catch (error) {
        console.error(`联合更新订单 ${orderNumber} 失败:`, error);
        res.status(500).json({ success: false, message: '联合更新失败', error: error.message });
    }
});

/**
 * 退押金
 * POST /api/orders/:order_id/refund-deposit
 */
router.post('/:order_id/refund-deposit',  async (req, res) => {
  try {
    const refundData = req.body;
    // 调用退押金方法
    const updatedOrder = await orderModule.refundDeposit(refundData);

    res.json({
      message: '退押金处理成功',
      order: updatedOrder,
      refundData: {
        change_price: refundData.change_price, // 实际退款金额
        method: refundData.method, // 退款方式
        refundTime: refundData.refundTime // 退款时间
      }
    });
  } catch (error) {
    console.error('退押金处理失败:', error.message);
    const msg = error.message || '退押金处理失败';
    // 仅将明确的业务校验错误判定为 400，"订单号不存在" 不属于客户端可修复错误
    const isClientError = msg.includes('退押金金额不能超过可退金额');
    const status = isClientError ? 400 : 500;
    res.status(status).json({
      // 服务端错误统一对外返回固定消息，满足测试期望
      message: isClientError ? msg : '退押金处理失败',
      error: msg,
      code: error.code || (isClientError ? 'REFUND_VALIDATION' : 'REFUND_SERVER_ERROR'),
      availableRefund: error.availableRefund,
      originalDeposit: error.originalDeposit,
      currentRefundedDeposit: error.currentRefundedDeposit
    });
  }
});

/** 获取订单押金状态（基于账单） */
router.get('/:order_id/deposit-info', async (req, res) => {
  try {
    const { order_id } = req.params;
    const status = await orderModule.getDepositStatus(order_id);
    res.json({ success: true, data: status });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取押金状态失败', error: e.message });
  }
});


/**
 * 办理入住
 * POST /api/orders/:orderId/check-in
 * 请求体: { deposit: number } - 实际收取的押金金额
 */
router.post('/:orderId/check-in', async (req, res) => {
  const { orderId } = req.params;
  const { deposit, dailyPrices } = req.body || {}; // 从请求体获取押金金额和每日房价
  let client;

  try {
    client = await getClient();
    console.log('✅ [check-in] 获取数据库连接成功');
    await client.query('BEGIN');
    console.log('✅ [check-in] 事务开始');

    // 1. 获取订单信息
    const orderResult = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    console.log(`📝 [check-in] 查询订单结果: 找到 ${orderResult.rows.length} 条记录`);

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const order = orderResult.rows[0];

    // 2. 检查订单状态
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `订单状态为 '${order.status}'，无法办理入住，只有待入住订单可以办理`
      });
    }

    // 3. 更新订单的押金金额（使用前端传入的押金）
    const actualDeposit = deposit !== undefined ? Number(deposit) : Number(order.deposit || 0);

    if (actualDeposit !== Number(order.deposit)) {
      await client.query(
        'UPDATE orders SET deposit = $1 WHERE order_id = $2',
        [actualDeposit, orderId]
      );
      console.log(`📝 更新订单 ${orderId} 押金: ${order.deposit} -> ${actualDeposit}`);
    }

    // 4. 格式化日期（确保是 YYYY-MM-DD 格式）
    const stayDate = formatDate(order.check_in_date);
    const stayType = order.stay_type || '客房'; // 默认值为客房

    // 5. 按日期为每一天创建房费账单（可自定义每日价格）
    const checkInDate = new Date(order.check_in_date);
    const checkOutDate = new Date(order.check_out_date);
    let stayDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // 对于休息房等当天退房的情况（stayDays === 0），按1天计算
    if (stayDays === 0) {
      console.log(`📝 [check-in] 检测到休息房订单（同日入住退房），按1天计算`);
      stayDays = 1;
    } else if (stayDays < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: '退房日期不能早于入住日期'
      });
    }

    console.log('🧮 [check-in] stayDays:', stayDays, 'total_price:', order.total_price, 'dailyPrices:', dailyPrices);

    // 如果前端提供了每日房价数组，则使用；否则平均分摊
    const customPrices = Array.isArray(dailyPrices) && dailyPrices.length === stayDays
      ? dailyPrices.map(Number)
      : Array(stayDays).fill(stayDays > 0 ? Number((Number(order.total_price) / stayDays).toFixed(2)) : 0);

    const createdBills = [];

    for (let i = 0; i < stayDays; i++) {
      const stayDateEach = new Date(checkInDate);
      stayDateEach.setDate(checkInDate.getDate() + i);

      const price = customPrices[i]; // 使用自定义或默认价格

      const insertRoomFeeBillQuery = `
        INSERT INTO bills (
          order_id, room_number, guest_name, change_price, change_type,
          pay_way, create_time, remarks, stay_type, stay_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const roomFeeBillResult = await client.query(insertRoomFeeBillQuery, [
        orderId,
        String(order.room_number).slice(0, 10),
        order.guest_name,
        price,
        setup.changeType.roomFee,
        order.payment_method,
        new Date(),
        `第 ${i + 1} 天房费`,
        stayType,
        formatDate(stayDateEach)
      ]);

      createdBills.push(roomFeeBillResult.rows[0]);
    }

    // 6. 如果有押金，插入押金账单（使用实际收取的押金金额）
    if (actualDeposit && Number(actualDeposit) > 0) {
      const insertDepositBillQuery = `
        INSERT INTO bills (
          order_id, room_number, guest_name, change_price, change_type,
          pay_way, create_time, remarks, stay_type, stay_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const depositBillResult = await client.query(insertDepositBillQuery, [
        orderId,
        String(order.room_number).slice(0, 10), // 截断到 10 个字符以适应 bills 表
        order.guest_name,
        Number(actualDeposit), // 使用实际收取的押金金额
        setup.changeType.deposit,
        order.payment_method,
        new Date(),
        '办理入住押金',
        stayType,
        stayDate
      ]);

      createdBills.push(depositBillResult.rows[0]);
      console.log(`💰 创建押金账单: ¥${actualDeposit}`);
    } else {
      console.log('💰 未收取押金，不创建押金账单');
    }

    // 7. 更新订单状态为已入住
    const updateOrderQuery = `
      UPDATE orders
      SET status = 'checked-in'
      WHERE order_id = $1
      RETURNING *
    `;
    const updatedOrderResult = await client.query(updateOrderQuery, [orderId]);
    const updatedOrder = updatedOrderResult.rows[0];

    // 8. 更新房间状态为已入住 (occupied)
    const updateRoomQuery = `
      UPDATE rooms
      SET status = 'occupied'
      WHERE room_number = $1
      RETURNING *
    `;
    await client.query(updateRoomQuery, [order.room_number]);

    // 提交事务
    await client.query('COMMIT');

    // 格式化账单中的日期字段
    const formattedBills = createdBills.map(bill => ({
      ...bill,
      stay_date: formatDate(bill.stay_date)
    }));

    return res.status(200).json({
      success: true,
      message: '办理入住成功',
      data: {
        order: updatedOrder,
        bills: formattedBills
      }
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('办理入住失败:', error);
    return res.status(500).json({
      success: false,
      message: '办理入住失败',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
