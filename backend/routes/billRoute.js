const express = require('express');
const router = express.Router();
router.use(express.json());
const billModule = require('../modules/billModule');
const { query } = require('../database/postgreDB/pg');
const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);

const pay_way = ['现金', '微信', '微邮付', '平台'];

const addBillSchema = {
  type: 'object',
  properties: {
    order_id: { type: 'string' },
    change_price: { type: 'number' },
    change_type: {
      type: 'string',
      enum: ['房费', '收押', '退押', '补收', '退款']
    },
    method: { type: 'string',
      enum: pay_way
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
    pay_way: { type: 'string', enum: pay_way },
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
    const newBill = await billModule.addBill(req.body);
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

    const incomeDateObj = income_date ? new Date(income_date) : new Date();
    if (Number.isNaN(incomeDateObj.getTime())) {
      return res.status(400).json({ message: 'income_date 格式不正确' });
    }

    const formatDateTimeForDB = (input) => {
      const dateObj = input ? new Date(input) : new Date();
      if (Number.isNaN(dateObj.getTime())) {
        throw new Error(`无效的日期时间格式: ${input}`);
      }
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const millis = String(dateObj.getMilliseconds()).padStart(3, '0');
      const micros = `${millis}000`;
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${micros}`;
    };

    const createTime = formatDateTimeForDB(incomeDateObj);
    const stayDate = incomeDateObj.toISOString().split('T')[0];

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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;

    const values = [
      null, // order_id
      null, // room_number
      guest_name || '其他收入',
      numericAmount, // 收入正数
      income_type || '其他收入',
      pay_way,
      createTime,
      remarks || '',
      '租车收入',
      stayDate
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
      LEFT JOIN orders o ON b.order_id = o.order_id
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

module.exports = router;
