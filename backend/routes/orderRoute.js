const express = require('express');
const router = express.Router();
const orderTable = require('../database/postgreDB/tables/order'); // 路径相对于当前文件
const { body, validationResult } = require('express-validator');
const { query } = require('../database/postgreDB/pg');

// GET /api/orders - 获取所有订单
router.get('/', async (req, res) => {
  try {
    console.log('获取所有订单请求');

    // 检查orders表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'orders'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('orders表不存在，返回模拟数据');
      // 返回一些模拟数据
      return res.json({
        data: [
          {
            order_id: 'ORD20240001',
            order_source: 'online',
            guest_name: '张三',
            phone: '13800138000',
            id_number: '110101199001011234',
            room_type: 'standard',
            room_number: '101',
            check_in_date: '2024-04-10',
            check_out_date: '2024-04-12',
            status: 'confirmed',
            payment_method: 'wechat',
            room_price: 576.00,
            deposit: 200.00,
            create_time: '2024-04-08T10:30:00',
            remarks: '需要安静的房间'
          },
          {
            order_id: 'ORD20240002',
            order_source: 'phone',
            guest_name: '李四',
            phone: '13900139000',
            id_number: '310101199102023456',
            room_type: 'deluxe',
            room_number: '201',
            check_in_date: '2024-04-15',
            check_out_date: '2024-04-18',
            status: 'checked_in',
            payment_method: 'alipay',
            room_price: 1164.00,
            deposit: 300.00,
            create_time: '2024-04-09T14:15:00',
            actual_check_in_time: '2024-04-15T14:00:00',
            remarks: '商务客人，需要提供发票'
          }
        ]
      });
    }

    // 查询所有订单
    const { rows } = await query('SELECT * FROM orders ORDER BY create_time DESC');
    console.log(`成功获取 ${rows.length} 条订单数据`);
    res.json({ data: rows });
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

    const { rows } = await query('SELECT * FROM orders WHERE order_id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到订单' });
    }

    res.json({ data: rows[0] });
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
router.post('/',
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
    body('status').notEmpty().withMessage('订单状态不能为空').isString(),
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
      const newOrder = await orderTable.createOrder(orderDataForDb);
      // 实际应用中，创建订单后可能还需要更新房间状态等操作，这里简化处理
      // 例如，调用 roomStore.reserveRoom 或 roomStore.occupyRoom 的后端等效逻辑
      res.status(201).json({ message: '订单创建成功', order: newOrder });
    } catch (error) {
      console.error('创建订单失败:', error);
      res.status(500).json({ message: '创建订单失败', error: error.message });
    }
  }
);

module.exports = router;
