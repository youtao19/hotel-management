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
    // 规则：全部账单统一按 create_time 的日期过滤
    const sql = `
      SELECT
        b.bill_id,
        b.order_id,
        b.stay_date,
        o.stay_type,
        b.change_price,
        b.change_type,
        b.pay_way,
        b.create_time,
        o.room_number,
        o.guest_name,
        o.phone,
        o.status as order_status
      FROM bills b
      LEFT JOIN orders o ON b.order_id = o.order_id
      WHERE DATE(b.create_time) = $1::date
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
