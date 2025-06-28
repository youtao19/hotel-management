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
    const { type, startDate, endDate, date } = req.query;

    // 支持两种参数格式：date 或 startDate/endDate
    const finalStartDate = startDate || date || new Date().toISOString().split('T')[0];
    const finalEndDate = endDate || date || new Date().toISOString().split('T')[0];

    // 验证参数
    if (type && !['hotel', 'rest'].includes(type)) {
      return res.status(400).json({
        error: '无效的交接班类型，必须是 hotel 或 rest'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (finalStartDate && !dateRegex.test(finalStartDate)) {
      return res.status(400).json({
        error: '无效的开始日期格式，应为 YYYY-MM-DD'
      });
    }
    if (finalEndDate && !dateRegex.test(finalEndDate)) {
      return res.status(400).json({
        error: '无效的结束日期格式，应为 YYYY-MM-DD'
      });
    }

    const details = await getReceiptDetails(
      type,
      finalStartDate,
      finalEndDate
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
    const { date, startDate, endDate } = req.query;

    // 支持两种参数格式：date 或 startDate/endDate
    const finalStartDate = startDate || date || new Date().toISOString().split('T')[0];
    const finalEndDate = endDate || date || new Date().toISOString().split('T')[0];

    const statistics = await getStatistics(finalStartDate, finalEndDate);
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
      cashier_name: req.body.cashier_name || '',
      shift_time: req.body.shift_time || new Date().toTimeString().slice(0, 5)
    };

    const result = await saveHandover(handoverData);
    res.status(201).json({
      success: true,
      message: '交接班记录保存成功',
      id: result.id,
      data: result
    });
  } catch (error) {
    console.error('保存交接班记录失败:', error);

    // 根据错误类型返回不同的状态码
    if (error.message.includes('不能为空') || error.message.includes('必须是')) {
      res.status(400).json({
        success: false,
        message: '保存交接班记录失败',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: '保存交接班记录失败',
        error: error.message
      });
    }
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
