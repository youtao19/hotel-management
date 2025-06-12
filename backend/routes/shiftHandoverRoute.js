const express = require('express');
const router = express.Router();
const {
  getReceiptDetails,
  getStatistics,
  saveHandover,
  getHandoverHistory,
  exportHandoverToExcel
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
      cashier_name: req.body.cashier_name || '未知',
      shift_time: req.body.shift_time || new Date().toTimeString().slice(0, 5)
    };

    const result = await saveHandover(handoverData);
    res.json({
      success: true,
      message: '交接班记录保存成功',
      data: result
    });
  } catch (error) {
    console.error('保存交接班记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存交接班记录失败',
      error: error.message
    });
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

// 导出Excel
router.post('/export', async (req, res) => {
  try {
    const buffer = await exportHandoverToExcel(req.body);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="shift_handover_${req.body.date || new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('导出Excel失败:', error);
    res.status(500).json({
      success: false,
      message: '导出Excel失败',
      error: error.message
    });
  }
});

module.exports = router;
