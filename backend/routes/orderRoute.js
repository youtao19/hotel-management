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
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// POST /api/orders - 创建新订单
router.post('/', authenticationMiddleware,
  [
    // 基本的输入验证 - 根据您的 db_schema.sql 和 CreateOrder.vue 进行调整
    body('orderNumber').notEmpty().withMessage('订单号不能为空').isString().trim(),
    body('source').notEmpty().withMessage('订单来源不能为空').isString(),
    body('guestName').notEmpty().withMessage('客人姓名不能为空').isString().trim(),
    body('idNumber').notEmpty().withMessage('身份证号不能为空').isString().isLength({ min: 18, max: 18 }).withMessage('身份证号必须为18位'),
    body('phone').notEmpty().withMessage('手机号不能为空').isString().isLength({ min: 11, max: 11 }).withMessage('手机号必须为11位'),
    body('roomType').notEmpty().withMessage('房间类型不能为空').isString(),
    body('roomNumber').notEmpty().withMessage('房间号不能为空').isString(),
    body('checkInDate').notEmpty().withMessage('入住日期不能为空').isISO8601().toDate(),
    body('checkOutDate').notEmpty().withMessage('离店日期不能为空').isISO8601().toDate(),
    body('status')
      .notEmpty().withMessage('订单状态不能为空')
      .isString()
      .custom(value => {
        if (!VALID_ORDER_STATES.includes(value)) {
          throw new Error(`无效的订单状态。有效状态: ${VALID_ORDER_STATES.join(', ')}`);
        }
        return true;
      }),
    body('paymentMethod').optional({ checkFalsy: true }).isString(), // 支付方式可以为空或字符串
    body('roomPrice').notEmpty().withMessage('房间金额不能为空').isDecimal(),
    body('deposit').optional({ checkFalsy: true }).isDecimal(), // 押金可以为空或数字
    body('createTime').notEmpty().withMessage('创建时间不能为空').isISO8601().toDate(),
    // sourceNumber, remarks, actualCheckInTime, actualCheckOutTime 是可选的，不需要强制验证 notEmpty
    body('sourceNumber').optional({ checkFalsy: true }).isString().trim(),
    body('remarks').optional({ checkFalsy: true }).isString().trim(),
    body('actualCheckInTime').optional({ checkFalsy: true }).isISO8601().toDate(),
    body('actualCheckOutTime').optional({ checkFalsy: true }).isISO8601().toDate(),
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

    // 从 req.body 中提取数据，并映射到数据库表字段名
    const orderDataForDb = {
      order_id: req.body.orderNumber, // orders 表中的 order_id
      id_source: req.body.sourceNumber || null, // orders 表中的 id_source (对应前端 sourceNumber)
      order_source: req.body.source, // orders 表中的 order_source
      guest_name: req.body.guestName,
      phone: req.body.phone,
      id_number: req.body.idNumber,
      room_type: req.body.roomType,
      room_number: req.body.roomNumber,
      check_in_date: req.body.checkInDate,
      check_out_date: req.body.checkOutDate,
      status: req.body.status,
      // 前端 paymentMethod 可能是一个对象 {label: '支付宝', value: 'alipay'} 或直接是值 'alipay'
      // 后端需要的是值，例如 'alipay'
      payment_method: req.body.paymentMethod ? (typeof req.body.paymentMethod === 'object' ? req.body.paymentMethod.value : req.body.paymentMethod) : null,
      room_price: req.body.roomPrice,
      deposit: req.body.deposit,
      create_time: req.body.createTime,
      actual_check_in_time: req.body.actualCheckInTime || null,
      actual_check_out_time: req.body.actualCheckOutTime || null,
      remarks: req.body.remarks || null,
    };

    try {
      const newOrder = await orderModule.createOrder(orderDataForDb);
      // 实际应用中，创建订单后可能还需要更新房间状态等操作，这里简化处理
      // 例如，调用 roomStore.reserveRoom 或 roomStore.occupyRoom 的后端等效逻辑
      res.status(201).json({ message: '订单创建成功', order: newOrder });
    } catch (error) {
      console.error('创建订单失败:', error);
      res.status(500).json({ message: '创建订单失败', error: error.message });
    }
  }
);

// PUT /api/orders/:orderNumber/status - 更新订单状态
router.put('/:orderNumber/status', authenticationMiddleware, [
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
