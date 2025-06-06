const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication'); // Correctly import authenticationMiddleware

// 定义有效的订单状态
const VALID_ORDER_STATES = ['pending', 'checked-in', 'checked-out', 'cancelled'];

// GET /api/orders - 获取所有订单
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

// 获取特定ID的订单
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

// POST /api/orders - 创建新订单

router.post('/new', authenticationMiddleware,
  [
    // 基本的输入验证 - 使用后端字段名
    body('order_id').notEmpty().withMessage('订单号不能为空').isString().trim(),
    body('order_source').notEmpty().withMessage('订单来源不能为空').isString(),
    body('guest_name').notEmpty().withMessage('客人姓名不能为空').isString().trim(),
    body('id_number').notEmpty().withMessage('身份证号不能为空').isString().isLength({ min: 18, max: 18 }).withMessage('身份证号必须为18位'),
    body('phone').notEmpty().withMessage('手机号不能为空').isString().isLength({ min: 11, max: 11 }).withMessage('手机号必须为11位'),
    body('room_type').notEmpty().withMessage('房间类型不能为空').isString(),
    body('room_number').notEmpty().withMessage('房间号不能为空').isString(),
    body('check_in_date').notEmpty().withMessage('入住日期不能为空').isISO8601().toDate(),
    body('check_out_date').notEmpty().withMessage('离店日期不能为空').isISO8601().toDate(),
    body('status')
      .notEmpty().withMessage('订单状态不能为空')
      .isString()
      .custom(value => {
        if (!VALID_ORDER_STATES.includes(value)) {
          throw new Error(`无效的订单状态。有效状态: ${VALID_ORDER_STATES.join(', ')}`);
        }
        return true;
      }),
    body('payment_method').optional({ checkFalsy: true }).isString(), // 支付方式可以为空或字符串
    body('room_price').notEmpty().withMessage('房间金额不能为空').isDecimal(),
    body('deposit').optional({ checkFalsy: true }).isDecimal(), // 押金可以为空或数字
    body('create_time').notEmpty().withMessage('创建时间不能为空').isISO8601().toDate(),
    // id_source, remarks 是可选的，不需要强制验证 notEmpty
    body('id_source').optional({ checkFalsy: true }).isString().trim(),
    body('remarks').optional({ checkFalsy: true }).isString().trim(),
  ],
  async (req, res) => {
    console.log('收到订单创建请求，请求体:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = errors.array();
      console.log('订单验证失败，具体错误:');
      validationErrors.forEach((err, i) => {
        console.log(`${i+1}. 字段 ${err.path}: ${err.msg}`);
      });
      return res.status(400).json({ errors: validationErrors });
    }

    try {
      const newOrder = await orderModule.createOrder(req.body);
      res.status(201).json({ message: '订单创建成功', order: newOrder });
    } catch (error) {
      console.error('创建订单失败:', error);
      res.status(500).json({ message: '创建订单失败', error: error.message });
    }
  }
);

// PUT /api/orders/:orderNumber/status - 更新订单状态
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

module.exports = router;
