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

module.exports = router;
