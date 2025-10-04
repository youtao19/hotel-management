const express = require('express');
const router = express.Router();
router.use(express.json());
const billModule = require('../modules/billModule');

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
    const newBill = await billModule.addBill(req.body);
    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ message: '添加账单失败', error: err.message });
  }
});

// 根据订单ID获取账单
router.get('/order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const bills = await billModule.getBillsByOrderId(orderId);
    res.json({ data: bills });
  } catch (err) {
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

// 获取订单账单详情（按日期分组）
router.get('/order/:orderId/details', async (req, res) => {
  const { orderId } = req.params;
  try {
    const billDetails = await billModule.getOrderBillDetails(orderId);
    res.json({ success: true, data: billDetails });
  } catch (err) {
    res.status(500).json({ message: '获取订单账单详情失败', error: err.message });
  }
});

// 更新账单信息
router.put('/:billId', async (req, res) => {
  const { billId } = req.params;
  try {
    const updatedBill = await billModule.updateBill(billId, req.body);
    if (!updatedBill) {
      return res.status(404).json({ message: '账单不存在' });
    }
    res.json({ success: true, data: updatedBill });
  } catch (err) {
    res.status(500).json({ message: '更新账单失败', error: err.message });
  }
});

// 按订单ID和日期更新账单
router.put('/order/:orderId/date/:stayDate', async (req, res) => {
  const { orderId, stayDate } = req.params;
  try {
    const updatedBills = await billModule.updateBillByOrderAndDate(orderId, stayDate, req.body);
    if (!updatedBills || updatedBills.length === 0) {
      return res.status(404).json({ message: '指定日期的账单不存在' });
    }
    res.json({ success: true, data: updatedBills });
  } catch (err) {
    res.status(500).json({ message: '更新账单失败', error: err.message });
  }
});

// 获取指定日期的所有账单（用于交接班核对数据）
router.get('/by-date/:date', async (req, res) => {
  const { date } = req.params;
  const { query } = require('../database/postgreDB/pg');

  try {
    // 查询指定日期的所有账单，关联订单信息
    const sql = `
      SELECT
        b.bill_id,
        b.order_id,
        b.stay_date,
        b.stay_type,
        b.room_fee,
        b.deposit,
        b.pay_way,
        b.change_type,
        b.change_price,
        o.room_number,
        o.guest_name,
        o.phone_number,
        o.status as order_status
      FROM bills b
      LEFT JOIN orders o ON b.order_id = o.order_id
      WHERE b.stay_date::date = $1::date
        AND b.change_type = '订单账单'
      ORDER BY b.stay_type, b.bill_id ASC
    `;

    const result = await query(sql, [date]);

    // 按住宿类型分组
    const hotelBills = result.rows.filter(bill => bill.stay_type === '客房');
    const restBills = result.rows.filter(bill => bill.stay_type === '休息房');

    res.json({
      success: true,
      data: {
        hotelBills,
        restBills,
        totalCount: result.rows.length
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
