const express = require('express');
const router = express.Router();
router.use(express.json());
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication');
const setup = require('../appSettings/setup');
const { toAmountNumber } = require('../modules/tools');
const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);
const ORDER_DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/; // 列表筛选日期格式校验

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'reserved', 'checked-in', 'checked-out', 'occupied', 'cancelled'];
const SPLIT_PAY_WAYS = ['现金', '微信', '微邮付', '平台'];
const splitItemSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: SPLIT_PAY_WAYS },
    amount: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    }
  },
  required: ['method', 'amount'],
  additionalProperties: false
};

function normalizeOptionalSplitField(rawValue) {
  if (rawValue === undefined || rawValue === null) return undefined;
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? rawValue : undefined;
  }
  if (typeof rawValue === 'object') {
    return Object.keys(rawValue).length > 0 ? rawValue : undefined;
  }
  return rawValue;
}


const createOrderSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    sourceNumber: { type: 'string' },
    orderSource: { type: 'string' },
    guestName: { type: 'string' },
    roomType: { type: 'string' },
    roomNumber: { type: 'string' },
    checkInDate: { type: 'string', format: 'date' },
    checkOutDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: VALID_ORDER_STATES },
    paymentMethod: { type: 'string' },
    phone: {
      type: 'string',
      pattern: '^$|^1[3-9]\\d{9}$'
    },
    roomPrice: {
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
    isPrepaid: { type: 'boolean' },
    prepaidAmount: { type: 'number', minimum: 0 },
    roomFeePaymentSplits: {
      anyOf: [
        {
          type: 'array',
          minItems: 1,
          items: splitItemSchema
        },
        {
          type: 'object',
          additionalProperties: {
            type: 'array',
            minItems: 1,
            items: splitItemSchema
          }
        }
      ]
    },
    depositPaymentSplits: {
      type: 'array',
      minItems: 1,
      items: splitItemSchema
    },
    depositPaymentMethod: { type: 'string', enum: SPLIT_PAY_WAYS },
    stayType: { type: 'string', enum: ['客房', '休息房'] },
    createTime: { type: 'string', format: 'date-time' },
    remarks: { type: 'string' }
  },
  required: ['orderId', 'orderSource', 'guestName', 'roomType', 'roomNumber', 'checkInDate', 'checkOutDate', 'status', 'paymentMethod', 'roomPrice', 'stayType'],
  additionalProperties: true
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

const earlyCheckoutSchema = {
  type: 'object',
  properties: {
    actualCheckoutTime: { type: 'string', minLength: 10, maxLength: 32 },
    refundAmount: {
      anyOf: [
        { type: 'number', minimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$' }
      ]
    },
    refundMethod: { type: 'string' },
    operator: { type: 'string' },
    hasStayed: { type: 'boolean' },
    remarks: { type: 'string' }
  },
  required: ['actualCheckoutTime', 'refundAmount'],
  additionalProperties: false
};

const pricingBreakdownSchema = {
  type: 'object',
  properties: {
    checkInDate: { type: 'string', format: 'date' },
    checkOutDate: { type: 'string', format: 'date' },
    mode: { type: 'string', enum: ['from-room-price', 'distribute-total'] },
    basePrice: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    },
    totalPrice: {
      anyOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^(0|[1-9]\\d*)(\\.\\d{1,2})?$', not: { const: '0' } }
      ]
    }
  },
  required: ['checkInDate', 'checkOutDate', 'mode'],
  allOf: [
    {
      if: { properties: { mode: { const: 'from-room-price' } } },
      then: { required: ['basePrice'] }
    },
    {
      if: { properties: { mode: { const: 'distribute-total' } } },
      then: { required: ['totalPrice'] }
    }
  ],
  additionalProperties: false
};



/**
 * 获取所有订单
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, date } = req.query || {};
    const normalizedSearch = search ? String(search).trim() : '';
    const normalizedStatus = status ? String(status).trim() : '';
    const normalizedDate = date ? String(date).trim() : '';

    if (normalizedStatus && !VALID_ORDER_STATES.includes(normalizedStatus)) {
      return res.status(400).json({
        message: '订单状态筛选参数不合法',
        error: 'INVALID_STATUS_FILTER'
      });
    }
    if (normalizedDate && !ORDER_DATE_FILTER_REGEX.test(normalizedDate)) {
      return res.status(400).json({
        message: '日期筛选格式错误，请使用 YYYY-MM-DD',
        error: 'INVALID_DATE_FILTER'
      });
    }

    // 中文注释：订单列表筛选逻辑统一在后端处理，前端只传筛选条件。
    const orders = await orderModule.getAllOrders({
      search: normalizedSearch || undefined,
      status: normalizedStatus || undefined,
      date: normalizedDate || undefined
    });
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
 * 获取所有订单的每日明细
 * GET /api/orders/daily
 */
router.get('/daily', async (req, res) => {
  try {
    console.log('获取所有订单每日明细请求');
    const orders = await orderModule.getAllOrdersDaily();
    console.log(`成功获取 ${orders.length} 条每日明细数据`);
    res.status(200).json({ data: orders });
  } catch (err) {
    console.error('获取订单每日明细错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

/**
 * 创建订单定价拆分（前端创建订单用）
 * POST /api/orders/pricing/breakdown
 */
router.post('/pricing/breakdown', async (req, res) => {
  try {
    const validate = ajv.compile(pricingBreakdownSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const result = await orderModule.getPricingBreakdown(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('定价拆分失败:', err);
    const code = err.code || 'UNKNOWN';
    const status = ['INVALID_DATE_RANGE', 'INVALID_PRICE', 'INVALID_MODE'].includes(code) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || '定价拆分失败',
      error: { code, details: err.message }
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

  try {
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
    switch (error.code) {
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
 * 更新订单状态
 * POST /api/orders/:/status
 */
router.post('/:orderNumber/status', async (req, res) => {
  try {
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
    const { newStatus } = req.body;
    const updatedOrder = await orderModule.updateOrderStatus(orderNumber, newStatus);
    if (!updatedOrder) {
      return res.status(404).json({ message: '未找到订单或更新失败' });
    }
    res.json({ message: '订单状态更新成功', order: updatedOrder });
  } catch (error) {
    console.error(`更新订单 ${req.params?.orderNumber || ''} 状态失败:`, error);
    res.status(500).json({ message: '更新订单状态失败', error: error.message });
  }
});

/**
 * 更新订单
 * PUT /api/orders/:orderNumber
 */
router.put('/:orderNumber', authenticationMiddleware, async (req, res) => {
  const { orderNumber } = req.params;
  try {
    const updatedFields = req.body;
    const updatedOrder = await orderModule.updateOrder(orderNumber, updatedFields);
    res.json({ success: true, message: '订单更新成功', data: updatedOrder });
  } catch (error) {
    console.error(`更新订单 ${orderNumber} 失败:`, error);
    res.status(500).json({ success: false, message: '更新订单失败', error: error.message });
  }
});

/**
 * 更新订单特定日期的房间号（多日分行结构支持）
 * PUT /api/orders/:orderNumber/day-room
 * 请求体: { stayDate: 'YYYY-MM-DD', newRoomNumber: '101' }
 */
router.put('/:orderNumber/day-room', authenticationMiddleware, async (req, res) => {
  const { orderNumber } = req.params;
  const { stayDate, newRoomNumber } = req.body;

  try {

    if (!stayDate || !newRoomNumber) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: stayDate 和 newRoomNumber'
      });
    }
    const changedBy = req.user?.username || 'system';
    const updatedRow = await orderModule.updateOrderDayRoom(orderNumber, stayDate, newRoomNumber, changedBy);
    res.json({
      success: true,
      message: `订单 ${orderNumber} 的 ${stayDate} 房间已更换为 ${newRoomNumber}`,
      data: updatedRow
    });
  } catch (error) {
    console.error(`更新订单 ${orderNumber} 日期 ${stayDate} 房间失败:`, error);
    res.status(error.message.includes('不存在') || error.message.includes('占用') || error.message.includes('不匹配') ? 400 : 500)
      .json({ success: false, message: error.message });
  }
});

/**
 * 更新订单和相关账单（联合事务：后端计算差异 + 按日同步）
 * PUT /api/orders/:orderNumber/with-bills
 * body: { orderData, roomPrice, changedBy }
 */
router.put('/:orderNumber/with-bills', authenticationMiddleware, async (req, res) => {
  const { orderNumber } = req.params;
  try {
    const body = req.body || {};
    const {
      orderData,
      roomPrice,
      changedBy,
      roomFeePaymentSplits,
      depositPaymentSplits,
      depositPaymentMethod
    } = body;
    // 说明：修改订单支持传入房费/押金拆分，后端统一做金额校验与账单落库。
    const paymentSplitPayload = {
      roomFeePaymentSplits,
      depositPaymentSplits,
      depositPaymentMethod
    };
    const result = await orderModule.updateOrderWithBills(
      orderNumber,
      orderData,
      roomPrice,
      changedBy,
      paymentSplitPayload
    );
    res.json(result);
  } catch (error) {
    console.error(`联合更新订单 ${orderNumber} 失败:`, error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: status === 500 ? '联合更新失败' : error.message,
      error: error.message,
      code: error.code || 'UPDATE_WITH_BILLS_ERROR'
    });
  }
});

/**
 * 提前退房：获取推荐退款信息（只读）
 * GET /api/orders/:orderNumber/early-checkout/recommendation?actualCheckoutTime=...&hasStayed=true
 */
router.get('/:orderNumber/early-checkout/recommendation', authenticationMiddleware, async (req, res) => {
  const { orderNumber } = req.params;
  try {
    const { actualCheckoutTime, hasStayed } = req.query || {}; // 读取推荐退款所需参数
    const result = await orderModule.getEarlyCheckoutRecommendation(orderNumber, actualCheckoutTime, hasStayed); // 传递是否已入住
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`获取提前退房推荐 ${orderNumber} 失败:`, error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? '获取提前退房推荐失败' : error.message,
      error: error.message,
      code: error.code || 'EARLY_CHECKOUT_RECOMMENDATION_ERROR'
    });
  }
});

/**
 * 提前退房
 * POST /api/orders/:orderNumber/early-checkout
 */
router.post('/:orderNumber/early-checkout', authenticationMiddleware, async (req, res) => {
  const { orderNumber } = req.params;
  try {
    const validate = ajv.compile(earlyCheckoutSchema);
    const valid = validate(req.body);
    if (!valid) {
      console.error('提前退房请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const { actualCheckoutTime, refundAmount, refundMethod, operator, remarks, hasStayed } = req.body;
    const changedBy = operator || req.user?.username || 'system';

    const result = await orderModule.earlyCheckout(orderNumber, {
      actualCheckoutTime,
      refundAmount,
      refundMethod,
      changedBy,
      remarks,
      hasStayed
    });

    return res.status(200).json({
      success: true,
      message: '提前退房办理成功',
      data: result
    });
  } catch (error) {
    console.error(`提前退房 ${orderNumber} 失败:`, error);
    const statusCode = error.statusCode || (error.code && error.code.startsWith('EARLY_CHECKOUT') ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? '提前退房办理失败' : error.message,
      error: error.message,
      code: error.code || 'EARLY_CHECKOUT_ERROR'
    });
  }
});

/**
 * 退押金
 * POST /api/orders/:order_id/refund-deposit
 */
router.post('/:order_id/refund-deposit', async (req, res) => {
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
  try {
    const { orderId } = req.params;
    const { deposit, roomFeePaymentSplits, depositPaymentSplits, depositPaymentMethod } = req.body || {};

    await orderModule.checkIn(orderId, deposit, undefined, {
      roomFeePaymentSplits,
      depositPaymentSplits,
      depositPaymentMethod
    });

    return res.status(200).json({
      success: true,
      message: '办理入住成功'
    });
  } catch (error) {
    console.error('❌ [check-in] 办理入住失败:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '办理入住失败' : error.message,
      error: error.message
    });
  }
})

/**
 * 快速入住：创建已入住订单和账单（使用事务）
 * POST /api/orders/fast-check-in
 */
router.post('/fast-check-in', async (req, res) => {
  try {
    const body = req.body || {};
    const normalizedRoomFeeSplits = normalizeOptionalSplitField(
      body.roomFeePaymentSplits ?? body.room_fee_payment_splits
    );
    const normalizedDepositSplits = normalizeOptionalSplitField(
      body.depositPaymentSplits ?? body.deposit_payment_splits
    );
    const orderData = {
      orderId: body.orderId || body.order_id,
      sourceNumber: body.sourceNumber || body.idSource || body.id_source || '',
      orderSource: body.orderSource || body.order_source,
      guestName: body.guestName || body.guest_name,
      phone: body.phone,
      roomType: body.room_types || body.roomType || body.room_type,
      roomNumber: body.roomNumber || body.room_number,
      checkInDate: body.checkInDate || body.check_in_date,
      checkOutDate: body.checkOutDate || body.check_out_date,
      status: body.status || 'checked-in',
      paymentMethod: body.paymentMethod || body.payment_method,
      roomPrice: body.roomPrice || body.total_price,
      deposit: body.deposit,
      isPrepaid: body.isPrepaid,
      prepaidAmount: body.prepaidAmount || body.prepaid_amount,
      roomFeePaymentSplits: normalizedRoomFeeSplits,
      depositPaymentSplits: normalizedDepositSplits,
      depositPaymentMethod: body.depositPaymentMethod || body.deposit_payment_method,
      stayType: body.stayType || body.stay_type,
      createTime: body.createTime || body.create_time,
      remarks: body.remarks
    };

    // 验证请求数据
    const validate = ajv.compile(createOrderSchema);
    const valid = validate(orderData);
    if (!valid) {
      console.error('快速入住请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const depositAmount = toAmountNumber(orderData.deposit || 0);

    console.log('🚀 收到快速入住请求:', {
      order_id: orderData.orderId,
      guest_name: orderData.guestName,
      room_number: orderData.roomNumber,
      deposit: depositAmount
    });

    // 调用业务逻辑函数
    const result = await orderModule.fastCheckIn(orderData, req.user?.name || 'system');

    console.log('✅ 快速入住成功:', result.order.order_id);

    return res.status(200).json({
      success: true,
      message: '快速入住成功',
      data: result
    });

  } catch (error) {
    console.error('❌ 快速入住失败:', error);
    // 重要：如果业务层已标注 statusCode/code，这里需要透传，
    // 否则前端只会看到“500”，无法判断是参数问题还是事务问题。
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '快速入住失败' : (error.message || '快速入住失败'),
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message
      }
    });
  }
});

/**
 * 办理退房：更修订单状态，并将房间状态设置为“cleaning“
 * POST /api/orders/:orderId/check-out
 */
router.post('/:orderId/check-out', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await orderModule.checkOut(orderId);
    console.log('✅ 办理退房成功:', orderId);

    return res.status(200).json({
      success: true,
      data: result,
      message: '办理退房成功'
    });
  } catch (error) {
    console.error('❌ [check-out] 办理退房失败:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '办理退房失败' : error.message,
      error: error.message
    });
  }
});

module.exports = router;
