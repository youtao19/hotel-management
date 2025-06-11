const express = require('express');
const router = express.Router();
const {
  getReceiptDetails,
  getStatistics,
  saveHandover,
  getHandoverHistory
} = require('../modules/shiftHandoverModule');

// 获取收款明细
router.get('/receipts', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const details = await getReceiptDetails(
      type,
      startDate || new Date().toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0]
    );
    res.json(details);
  } catch (error) {
    console.error('获取收款明细失败:', error);
    res.status(500).json({ message: '获取收款明细失败' });
  }
});

// 获取统计数据
router.get('/statistics', async (req, res) => {
  try {
    const { date } = req.query;
    const statistics = await getStatistics(
      date || new Date().toISOString().split('T')[0]
    );
    res.json(statistics);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

// 保存交接班记录
router.post('/save', async (req, res) => {
  try {
    const handoverData = {
      ...req.body,
      userId: 1 // 临时使用固定用户ID
    };
    const result = await saveHandover(handoverData);
    res.json(result);
  } catch (error) {
    console.error('保存交接班记录失败:', error);
    res.status(500).json({ message: '保存交接班记录失败' });
  }
});

// 获取历史记录
router.get('/history', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const history = await getHandoverHistory(startDate, endDate);
    res.json(history);
  } catch (error) {
    console.error('获取交接班历史记录失败:', error);
    res.status(500).json({ message: '获取交接班历史记录失败' });
  }
});

module.exports = router;
