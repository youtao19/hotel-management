const express = require('express');
const router = express.Router();
const {
  getReceiptDetails,
  getStatistics,
  exportHandoverToExcel,
  getPreviousHandoverData,
  getCurrentHandoverData,
  importReceiptsToShiftHandover,
  saveAmountChanges,
  getShiftTable,
  getRemarks,
  getShiftSpecialStats
} = require('../modules/shiftHandoverModule');

/**
 * 获取收款明细
 * 用于收款明细表
 * @param {string} type - 业务类型：hotel（跨天订单）、rest（同天订单）
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @param {string} date - 日期（可选，与startDate/endDate等效）
 */
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

/**
 * 获取统计数据
 * @param {string} date - 日期（可选，与startDate/endDate等效）
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 */

// 获取前一天的交接班记录
router.get('/previous-handover', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: '请提供日期参数'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: '无效的日期格式，应为 YYYY-MM-DD'
      });
    }

    console.log(`接收到获取前一天交接班记录请求，当前日期: ${date}`);

    const previousData = await getPreviousHandoverData(date);

    if (previousData) {
      console.log(`成功获取前一天交接班记录: ID=${previousData.id}, 日期=${previousData.shift_date}`);
      res.json(previousData);
    } else {
      console.log(`未找到日期 ${date} 的前一天交接班记录`);
      res.json(null);
    }
  } catch (error) {
    console.error('获取前一天交接班记录失败:', error);
    res.status(500).json({
      message: '获取前一天交接班记录失败',
      error: error.message
    });
  }
});

// 获取当天的交接班记录
router.get('/current-handover', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: '请提供日期参数'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: '无效的日期格式，应为 YYYY-MM-DD'
      });
    }

    console.log(`接收到获取当天交接班记录请求，日期: ${date}`);

    const currentData = await getCurrentHandoverData(date);

    if (currentData) {
      console.log(`成功获取当天交接班记录: ID=${currentData.id}, 日期=${currentData.shift_date}`);
      res.json(currentData);
    } else {
      console.log(`未找到日期 ${date} 的交接班记录`);
      res.json(null);
    }
  } catch (error) {
    console.error('获取当天交接班记录失败:', error);
    res.status(500).json({
      message: '获取当天交接班记录失败',
      error: error.message
    });
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

// 新的导出Excel接口（表格样式）
router.post('/export-new', async (req, res) => {
  try {
    const { exportNewHandoverToExcel } = require('../modules/shiftHandoverModule');
    const buffer = await exportNewHandoverToExcel(req.body);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // 对中文文件名进行URL编码，避免HTTP头部字符问题
    const filename = `交接班记录_${req.body.date}_${req.body.shift}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);

    res.send(buffer);
  } catch (error) {
    console.error('导出新版Excel失败:', error);
    res.status(500).json({
      success: false,
      message: '导出新版Excel失败',
      error: error.message
    });
  }
});

// 导入收款明细到交接班
router.post('/import-receipts', async (req, res) => {
  try {
    const importData = req.body;

    // 验证必要字段
    if (!importData.date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：date'
      });
    }

    if (!importData.paymentAnalysis) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：paymentAnalysis'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(importData.date)) {
      return res.status(400).json({
        success: false,
        message: '无效的日期格式，应为 YYYY-MM-DD'
      });
    }

    console.log(`接收到导入收款明细请求，日期: ${importData.date}`);

    const result = await importReceiptsToShiftHandover(importData);

    res.status(200).json({
      success: true,
      message: '收款明细导入成功',
      data: result
    });

  } catch (error) {
    console.error('导入收款明细到交接班失败:', error);
    res.status(500).json({
      success: false,
      message: '导入收款明细到交接班失败',
      error: error.message
    });
  }
});

// 保存金额修改
router.post('/save-amounts', async (req, res) => {
  try {
    const amountData = req.body;

    // 验证必要字段
    if (!amountData.date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：date'
      });
    }

    if (!amountData.paymentData) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：paymentData'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(amountData.date)) {
      return res.status(400).json({
        success: false,
        message: '无效的日期格式，应为 YYYY-MM-DD'
      });
    }

    console.log(`接收到保存金额修改请求，日期: ${amountData.date}`);

    const result = await saveAmountChanges(amountData);

    res.status(200).json({
      success: true,
      message: '金额修改保存成功',
      data: result
    });

  } catch (error) {
    console.error('保存金额修改失败:', error);
    res.status(500).json({
      success: false,
      message: '保存金额修改失败',
      error: error.message
    });
  }
});

// 获取交接表数据
router.get('/table', async (req, res) => {
  try {
    const { date } = req.query;
    const data = await getShiftTable({ date });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取备忘录数据
router.get('/remarks', async (req, res) => {
  console.log('开始获取备忘录数据')
  try {
    const { date } = req.query;
    const data = await getRemarks({ date });
    res.json({ success: true, data });
    console.log('备忘录数据获取成功',data)
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取交接班页面特殊统计（开房数、休息房数、好评邀/得）
router.get('/special-stats', async (req, res) => {
  try {
    const { date } = req.query;
    const data = await getShiftSpecialStats(date);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取交接班特殊统计失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
