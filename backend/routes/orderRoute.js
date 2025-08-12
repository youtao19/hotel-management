const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication');

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'checked-in', 'checked-out', 'cancelled'];

/**
 * 获取所有订单
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    console.log('获取所有订单请求');

    // 检查orders表是否存在
    const tableCheck = await orderModule.checkTableExists();

    if (!tableCheck.rows[0].exists) {
      console.log('orders表不存在！');
    }

    // 查询所有订单
    const orders = await orderModule.getAllOrders();
    console.log(`成功获取 ${orders.length} 条订单数据`);
    res.json({ data: orders });
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array();
    console.log('订单验证失败，具体错误:');
    validationErrors.forEach((err, i) => {
      console.log(`${i+1}. 字段 ${err.path}: ${err.msg}`);
    });
    return res.status(400).json({
      success: false,
      message: '订单数据验证失败',
      errors: validationErrors
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
router.post('/:orderNumber/status', authenticationMiddleware, [
    body('newStatus')
        .notEmpty().withMessage('新状态不能为空')
        .isString()
        .custom(value => {
            if (!VALID_ORDER_STATES.includes(value)) {
                throw new Error(`无效的订单状态。有效状态: ${VALID_ORDER_STATES.join(', ')}`);
            }
            return true;
        }),
    body('checkInTime').optional({ checkFalsy: true }).isISO8601().withMessage('入住时间格式无效').toDate(),
    body('checkOutTime').optional({ checkFalsy: true }).isISO8601().withMessage('退房时间格式无效').toDate(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
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
 * 退押金
 * POST /api/orders/:orderNumber/refund-deposit
 */
router.post('/:orderNumber/refund-deposit', [
  body('refundAmount').isNumeric().withMessage('退押金金额必须是数字'),
  body('actualRefundAmount').isNumeric().withMessage('实际退款金额必须是数字'),
  body('method').notEmpty().withMessage('退押金方式不能为空'),
  body('operator').notEmpty().withMessage('操作员不能为空')
], async (req, res) => {
  try {
    const { orderNumber } = req.params;
    console.log(`处理订单 ${orderNumber} 的退押金请求`);

    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }

    const refundData = {
      orderNumber,
      ...req.body,
      refundTime: new Date().toISOString()
    };

    // 调用退押金方法
    const updatedOrder = await orderModule.refundDeposit(refundData);

    res.json({
      message: '退押金处理成功',
      order: updatedOrder,
      refundData: {
        actualRefundAmount: refundData.actualRefundAmount, // 实际退款金额
        method: refundData.method, // 退款方式
        refundTime: refundData.refundTime // 退款时间
      }
    });

  } catch (error) {
    console.error('退押金处理失败:', error.message);
    const msg = error.message || '退押金处理失败';
    const validationIndicators = [
      '只有已退房或已取消的订单才能退押金',
      '该订单没有可退押金',
      '退押金金额不能超过可退金额',
      '订单号',
      '退款累计'
    ];
    const isClientError = validationIndicators.some(v => msg.includes(v));
    res.status(isClientError ? 400 : 500).json({
      message: msg,
      error: msg,
      code: error.code || (isClientError ? 'REFUND_VALIDATION' : 'REFUND_SERVER_ERROR'),
      availableRefund: error.availableRefund,
      originalDeposit: error.originalDeposit,
      currentRefundedDeposit: error.currentRefundedDeposit
    });
  }
});

/** 获取订单押金状态（基于账单） */
router.get('/:orderNumber/deposit-info', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const status = await orderModule.getDepositStatus(orderNumber);
    res.json({ success: true, data: status });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取押金状态失败', error: e.message });
  }
});

module.exports = router;
