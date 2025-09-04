const express = require('express');
const router = express.Router();
router.use(express.json());

const billModule = require('../modules/billModule');
const authentication = require("../modules/authentication");

// 获取所有账单
router.get('/', async (req, res) => {
  try {
    const bills = await billModule.getAllBills();
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ message: '获取所有账单失败', error: err.message });
  }
});

// 创建一笔手动的账单调整
router.post('/adjustment', authentication.ensureAuthenticated, billModule.createBillAdjustment);

// 获取单个账单（占位实现）
router.get('/:id', async (req, res) => {
  res.status(404).json({ message: '未实现的账单查询' });
});

// 创建账单（占位实现）
router.post('/new', async (req, res) => {
  res.status(201).json({ success: true, message: '账单占位已创建', data: req.body });
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

module.exports = router;
