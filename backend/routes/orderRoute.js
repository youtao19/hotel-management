const express = require('express');
const router = express.Router();
// 保险：为该路由挂载 JSON 解析（即使全局已启用）
router.use(express.json());
const { body, validationResult } = require('express-validator');
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication');

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'checked-in', 'checked-out', 'cancelled'];

/**
 * 更新订单信息
 * PATCH /api/orders/:orderId
 */
router.patch('/:orderId', [
  body('guest_name')
    .optional()
    .isString().withMessage('客人姓名必须是字符串'),
  body('phone')
    .optional()
    .isString().withMessage('手机号必须是字符串'),
  body('room_number')
    .optional()
    .isString().withMessage('房间号必须是字符串'),
  body('remarks')
    .optional()
    .isString().withMessage('备注必须是字符串'),
  body('id_card')
    .optional()
    .isString().withMessage('身份证必须是字符串'),
  body('gender')
    .optional()
    .isString().withMessage('性别必须是字符串'),
  body('source')
    .optional()
    .isString().withMessage('订单来源必须是字符串'),
  body('check_in_time')
    .optional()
    .isISO8601().withMessage('入住时间必须是有效的日期格式'),
  body('check_out_time')
    .optional()
    .isISO8601().withMessage('退房时间必须是有效的日期格式'),
  body('should_pay')
    .optional()
    .isNumeric().withMessage('应付金额必须是数字'),
  body('paid_amount')
    .optional()
    .isNumeric().withMessage('已付金额必须是数字'),
  body('deposit')
    .optional()
    .isNumeric().withMessage('押金必须是数字'),
  body('pay_way')
    .optional()
    .isString().withMessage('支付方式必须是字符串'),
  body('room_type')
    .optional()
    .isString().withMessage('房间类型必须是字符串'),
  body('order_status')
    .optional()
    .isIn(VALID_ORDER_STATES).withMessage('无效的订单状态'),
  body('active')
    .optional()
    .isBoolean().withMessage('活跃状态必须是布尔值'),
  body('order_number')
    .optional()
    .isString().withMessage('订单号必须是字符串'),
  body('discount')
    .optional()
    .isNumeric().withMessage('折扣必须是数字'),
  body('refund_deposit')
    .optional()
    .isNumeric().withMessage('退还押金必须是数字'),
  body('refund_method')
    .optional()
    .isString().withMessage('退款方式必须是字符串'),
  body('refund_amount')
    .optional()
    .isNumeric().withMessage('退款金额必须是数字'),
  body('days')
    .optional()
    .isNumeric().withMessage('天数必须是数字'),
  body('is_company')
    .optional()
    .isBoolean().withMessage('公司标志必须是布尔值'),
  body('company_name')
    .optional()
    .isString().withMessage('公司名称必须是字符串'),
  body('room_rate')
    .optional()
    .isNumeric().withMessage('房间费率必须是数字'),
  body('arrival_time')
    .optional()
    .isISO8601().withMessage('到达时间必须是有效的日期格式'),
  body('stay_type')
    .optional()
    .isString().withMessage('住宿类型必须是字符串')
], authenticationMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    const operator = req.user ? req.user.username : '未知用户';

    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }

    // 检查订单是否存在
    const order = await orderModule.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为 ${orderId} 的订单`
      });
    }

    // 操作人信息已在上面获取
    // 原始订单信息已经在上面获取到 order 变量中

    let updatedOrder;

    // 使用变更模块更新订单并记录历史
    if (req.app.locals.orderChangeModule) {
      const reason = updateData.changeReason || '前台修改';
      // 删除非数据库字段
      if (updateData.changeReason) delete updateData.changeReason;

      // 使用orderChangeModule更新订单（会自动记录历史）
      updatedOrder = await req.app.locals.orderChangeModule.updateOrder(
        orderId,
        updateData,
        reason,
        operator
      );
    } else {
      // 如果没有变更模块，则直接更新订单
      updatedOrder = await orderModule.updateOrder(orderId, updateData);
    }

    res.json({
      success: true,
      message: '订单更新成功',
      order: updatedOrder
    });
  } catch (error) {
    console.error(`更新订单失败:`, error);
    res.status(500).json({
      success: false,
      message: '更新订单失败',
      error: error.message
    });
  }
});

/**
 * 获取所有订单
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    const useGrace = String(req.query.useGracePeriod || '').toLowerCase() === 'true';
    console.log('获取所有订单请求', useGrace ? '(使用宽限缓存)' : '');

    // 简单内存缓存（app.locals）
    const cacheKey = 'ordersCache';
    const now = Date.now();
    const ttl = 5000; // 5秒
    if (useGrace && req.app.locals[cacheKey] && (now - req.app.locals[cacheKey].ts) < ttl) {
      const cached = req.app.locals[cacheKey].data || [];
      console.log(`命中订单缓存，共 ${cached.length} 条`);
      return res.json({ data: cached, cached: true });
    }

    // 使用受控会话，限制语句与锁等待时间
    const { getClient } = require('../database/postgreDB/pg');
    const client = await getClient();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '6000ms'");
      await client.query("SET LOCAL lock_timeout = '2000ms'");

      // 检查表
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'orders'
        ) AS exists;
      `);
      if (!tableCheck.rows[0].exists) {
        console.warn('orders表不存在！');
      }

      console.time('查询所有订单');
      const result = await client.query('SELECT * FROM orders ORDER BY create_time DESC');
      console.timeEnd('查询所有订单');
      const orders = result.rows || [];

      // 更新缓存
      req.app.locals[cacheKey] = { ts: now, data: orders };

      res.json({ data: orders });
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      // 将超时与锁等待转为可恢复的错误
      const msg = e.message || '';
      const isTimeout = /statement timeout|canceling statement due to statement timeout/i.test(msg);
      const isLockTimeout = /lock timeout/i.test(msg);
      if (isTimeout || isLockTimeout) {
        console.warn('获取订单超时/锁等待，返回503提示重试:', msg);
        return res.status(503).json({ message: '获取订单繁忙，请稍后重试', code: 'ORDERS_BUSY' });
      }
      throw e;
    } finally {
      client.release();
    }
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
  const t0 = Date.now();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { orderNumber } = req.params;
    const { newStatus, checkInTime, checkOutTime } = req.body;

    try {
    console.log(`[orderRoute] 收到状态更新请求 order=${orderNumber}, newStatus=${newStatus}`);
        const updatedOrder = await orderModule.updateOrderStatus(orderNumber, newStatus, { checkInTime, checkOutTime });
    console.log(`[orderRoute] 状态更新完成 order=${orderNumber}, 用时=${Date.now()-t0}ms, 命中=${!!updatedOrder}`);
        if (!updatedOrder) {
            return res.status(404).json({ message: '未找到订单或更新失败' });
        }
        res.json({ message: '订单状态更新成功', order: updatedOrder });
    } catch (error) {
    console.error(`[orderRoute] 更新订单 ${orderNumber} 状态为 ${newStatus} 失败(用时=${Date.now()-t0}ms):`, error);
        if (error.code === 'ORDER_UPDATE_BUSY') {
          return res.status(503).json({ message: '更新订单繁忙，请稍后重试', code: error.code });
        }
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

/** 获取订单变更历史 */
router.get('/:orderId/history', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 性能优化：添加缓存控制头
    res.setHeader('Cache-Control', 'private, max-age=60'); // 60秒客户端缓存

    // 验证orderChangeModule是否存在
    if (!req.app.locals.orderChangeModule) {
      return res.status(501).json({
        success: false,
        message: '订单变更历史功能未启用',
        data: []
      });
    }

    console.time(`获取订单${orderId}变更历史`);
    const history = await req.app.locals.orderChangeModule.getOrderChangeHistory(orderId);
    console.timeEnd(`获取订单${orderId}变更历史`);

    // 返回结果
    res.json({
      success: true,
      message: '获取订单变更历史成功',
      data: history
    });
  } catch (error) {
    console.error('获取订单变更历史失败:', error);

    // 错误响应
    res.status(500).json({
      success: false,
      message: '获取订单变更历史失败',
      error: error.message
    });
  }
});

module.exports = router;
