const express = require('express');
const router = express.Router();
router.use(express.json());
const billModule = require('../modules/billModule');
const { query } = require('../database/postgreDB/pg');
const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require("ajv-formats");
const { getOrderById } = require('../modules/orderModule');
addFormats(ajv);

const PAY_WAY = ['现金', '微信', '微邮付', '平台'];
const CHANGE_TYPE = ['房费', '收押', '退押', '补收', '退款'];

const addBillSchema = {
  type: 'object',
  properties: {
    order_id: { type: 'string' },
    change_price: { type: 'number' },
    change_type: {
      type: 'string',
      enum: CHANGE_TYPE
    },
    method: { type: 'string',
      enum: PAY_WAY
     },
    notes: { type: 'string' },
    refundTime: { type: 'string', format: 'date-time' }
  },
  required: ['order_id', 'change_price', 'change_type', 'method'],
  additionalProperties: false
};

const otherIncomeSchema = {
  type: 'object',
  properties: {
    income_type: { type: 'string', minLength: 1 },
    amount: { type: 'number' },
    pay_way: { type: 'string', enum: PAY_WAY },
    income_date: { type: 'string', format: 'date-time' },
    remarks: { type: 'string' },
    guest_name: { type: 'string' }
  },
  required: ['income_type', 'amount', 'pay_way', 'income_date'],
  additionalProperties: false
};

const validateOtherIncome = ajv.compile(otherIncomeSchema);

// 获取所有账单
router.get('/', async (req, res) => {
  try {
    const bills = await billModule.getAllBills();
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ message: '获取所有账单失败', error: err.message });
  }
});

// 添加账单
router.post('/add', async (req, res) => {
  try {
    const validate = ajv.compile(addBillSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式不正确', errors: validate.errors });
    }

    const { order_id } = req.body;
    let room_number = null;
    let guest_name = null;
    let stay_type = null;

    // 如果订单存在，补全房间、客人、入住类型信息
    const orderRows = await getOrderById(order_id);
    if (orderRows && orderRows.length) {
      room_number = orderRows[0].room_number || null;
      guest_name = orderRows[0].guest_name || null;
      stay_type = orderRows[0].stay_type || null;
    }

    const newBill = await billModule.addBill({
      ...req.body,
      pay_way: req.body.pay_way || req.body.method,
      remarks: req.body.remarks || req.body.notes || null,
      room_number,
      guest_name,
      stay_type,
      create_time: req.body.create_time || req.body.refundTime || null
    });
    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ message: '添加账单失败', error: err.message });
  }
});

// 添加其他收入账单（无订单号）
router.post('/other-income', async (req, res) => {
  try {
    const valid = validateOtherIncome(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式不正确', errors: validateOtherIncome.errors });
    }

    const {
      guest_name,
      amount,
      pay_way,
      income_type,
      income_date,
      remarks
    } = req.body;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'amount 必须是大于 0 的数字' });
    }

    const insertQuery = `
      INSERT INTO bills (
        order_id,
        room_number,
        guest_name,
        change_price,
        change_type,
        pay_way,
        create_time,
        remarks,
        stay_type,
        stay_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,($7::timestamptz)::date)
      RETURNING *
    `;

    const values = [
      null, // order_id
      null, // room_number
      guest_name || '其他收入',
      numericAmount, // 收入正数
      income_type || '其他收入',
      pay_way,
      income_date,
      remarks || '',
      '租车收入',
    ];

    const { rows } = await query(insertQuery, values);
    const newBill = rows[0];

    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ message: '添加其他收入失败', error: err.message });
  }
});

// 根据订单ID获取账单
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const bills = await billModule.getBillsByOrderId(orderId);
    res.json({ data: bills });
  } catch (err) {
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 获取订单账单详情（按日期分组）
router.get('/order/:orderId/details', async (req, res) => {
  try {
    const { orderId } = req.params;
    const billDetails = await billModule.getOrderBillDetails(orderId);
    res.json({ success: true, data: billDetails });
  } catch (err) {
    res.status(500).json({ message: '获取订单账单详情失败', error: err.message });
  }
});

// 更新账单信息
router.put('/:billId', async (req, res) => {
  try {
    const { billId } = req.params;
    const updatedBill = await billModule.updateBill(billId, req.body);
    if (!updatedBill) {
      return res.status(404).json({ message: '账单不存在' });
    }
    res.json({ success: true, data: updatedBill });
  } catch (err) {
    res.status(500).json({ message: '更新账单失败', error: err.message });
  }
});

// 获取指定日期的所有账单（用于交接班核对数据）
router.get('/by-date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    // 查询指定日期的所有账单，关联订单信息
    // 规则：全部账单统一按 create_time 的日期过滤
    // 注意：orders 为按天拆分结构，同一 order_id 可能有多行，需避免 join 造成账单重复展开
    const sql = `
      SELECT
        b.bill_id,
        b.order_id,
        b.stay_date,
        COALESCE(b.stay_type, o.stay_type) AS stay_type,
        b.change_price,
        b.change_type,
        b.pay_way,
        b.create_time,
        COALESCE(b.room_number, o.room_number) AS room_number,
        COALESCE(b.guest_name, o.guest_name) AS guest_name,
        o.phone,
        o.status as order_status
      FROM bills b
      LEFT JOIN LATERAL (
        SELECT
          ord.stay_type,
          ord.room_number,
          ord.guest_name,
          ord.phone,
          ord.status,
          ord.stay_date,
          ord.create_time
        FROM orders ord
        WHERE ord.order_id = b.order_id
        ORDER BY
          (ord.stay_date = b.stay_date) DESC,
          (ord.stay_date = DATE(b.create_time)) DESC,
          ord.stay_date DESC NULLS LAST,
          ord.create_time DESC NULLS LAST
        LIMIT 1
      ) o ON TRUE
      WHERE DATE(b.create_time) = $1::date
        AND COALESCE(b.pay_way, '') <> '平台'
      ORDER BY o.stay_type, b.order_id, b.bill_id ASC
    `;

    const result = await query(sql, [date]);

    console.log(`📊 [by-date] 查询到 ${result.rows.length} 条账单记录`);

    // 将原始账单数据按住宿类型分组（不做聚合）
    const allBills = result.rows.map(bill => ({
      bill_id: bill.bill_id,
      order_id: bill.order_id,
      stay_date: bill.stay_date,
      stay_type: bill.stay_type,
      change_type: bill.change_type,
      change_price: Number(bill.change_price || 0),
      pay_way: bill.pay_way,
      create_time: bill.create_time,
      room_number: bill.room_number,
      guest_name: bill.guest_name,
      phone: bill.phone,
      order_status: bill.order_status
    }));

    const hotelBills = allBills.filter(bill => bill.stay_type === '客房');
    const restBills = allBills.filter(bill => bill.stay_type === '休息房');
    const carBills = allBills.filter(bill =>
      bill.stay_type === '租车收入' ||
      bill.change_type === '租车收入' ||
      (!bill.order_id && (bill.stay_type === '其他' || !bill.stay_type))
    );

    const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他'];
    const normalizePayWay = (val) => (PAY_WAY_KEYS.includes(val) ? val : '其他');
    const isRefund = (type) => ['退押', '退押金', '退款'].includes(type);
    const isIncome = (type) => ['房费', '收押', '补收', '订单账单', '租车收入'].includes(type);
    const createPaywayBucket = () => PAY_WAY_KEYS.reduce((acc, k) => { acc[k] = 0; return acc; }, {});

    const addAmount = (bucket, payWay, amount) => {
      const key = normalizePayWay(payWay);
      const cents = Math.round((Number(amount) || 0) * 100);
      bucket[key] = Number(((bucket[key] || 0) + cents).toFixed(0));
    };

    const toAmountBucket = (bucketCents) => {
      const res = {};
      PAY_WAY_KEYS.forEach(k => {
        res[k] = Number(((bucketCents[k] || 0) / 100).toFixed(2));
      });
      return res;
    };

    const bucketsCents = {
      hotelIncome: createPaywayBucket(),
      restIncome: createPaywayBucket(),
      hotelRefundDeposit: createPaywayBucket(),
      restRefundDeposit: createPaywayBucket(),
      carRentIncome: createPaywayBucket()
    };

    const accumulate = (rows, incomeBucket, refundBucket) => {
      rows.forEach((bill) => {
        const type = bill.change_type;
        const payWay = bill.pay_way;
        const raw = Number(bill.change_price || 0);
        if (isIncome(type)) {
          addAmount(bucketsCents[incomeBucket], payWay, raw);
        } else if (isRefund(type)) {
          addAmount(bucketsCents[refundBucket], payWay, Math.abs(raw));
        }
      });
    };

    accumulate(hotelBills, 'hotelIncome', 'hotelRefundDeposit');
    accumulate(restBills, 'restIncome', 'restRefundDeposit');
    accumulate(carBills, 'carRentIncome', 'carRentIncome');

    const summaryDataObject = {
      hotelIncome: toAmountBucket(bucketsCents.hotelIncome),
      restIncome: toAmountBucket(bucketsCents.restIncome),
      hotelRefundDeposit: toAmountBucket(bucketsCents.hotelRefundDeposit),
      restRefundDeposit: toAmountBucket(bucketsCents.restRefundDeposit),
      carRentIncome: toAmountBucket(bucketsCents.carRentIncome),
      totalRooms: hotelBills.length,
      restRooms: restBills.length
    };

    console.log(`🏨 [by-date] 账单分组统计:`, {
      总账单数: allBills.length,
      客房账单: hotelBills.length,
      休息房账单: restBills.length,
      stay_type分布: allBills.reduce((acc, bill) => {
        acc[bill.stay_type || '未知'] = (acc[bill.stay_type || '未知'] || 0) + 1;
        return acc;
      }, {})
    });

    res.json({
      success: true,
      data: {
        hotelBills,
        restBills,
        carBills,
        summaryDataObject,
        totalCount: allBills.length
      },
      message: `成功获取 ${date} 的账单数据`
    });

  } catch (err) {
    console.error('获取指定日期账单失败:', err);
    res.status(500).json({
      success: false,
      message: '获取指定日期账单失败',
      error: err.message
    });
  }
});

router.post('/adjustment', async (req, res) => {
  try {
    const validate = ajv.compile(addBillSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({ message: '请求数据格式不正确', errors: validate.errors });
    }
    // 获取订单信息
    const orderRes = await getOrderById(req.body.order_id);
    if (!orderRes || orderRes.length === 0) {
      return res.status(400).json({ message: `订单号 '${req.body.order_id}' 不存在，无法调整金额` });
    }

    const data = {
      ...req.body,
      room_number: orderRes[0].room_number,
      pay_way: req.body.pay_way || req.body.method,
      remarks: req.body.remarks || req.body.notes || null,
      guest_name: orderRes[0].guest_name,
      stay_type: orderRes[0].stay_type,
      stay_date: null,
      create_time: req.body.create_time || null
    }

    // 插入调整账单
    const newBill = await billModule.addBill(data);
    console.log('💰金额调整账单已添加:', newBill);
    res.status(201).json({ success: true, data: newBill });

  } catch (err) {
    res.status(500).json({ message: '金额调整失败', error: err.message });
    throw err;
  }
})

module.exports = router;
