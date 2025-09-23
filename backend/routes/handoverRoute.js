const express =  require('express');
const router = express.Router();

const {
  getShiftTable,
  getRemarks,
  getShiftSpecialStats,
  getAvailableDates,
  getAvailableDatesFlexible,
  startHandover,
  saveAmountChanges,
  getHandoverTableData,
  saveAdminMemoToHandover,
  getAdminMemosFromHandover
} = require('../modules/handoverModule');


// 获取交接班表格数据（计算版本）
router.get('/table', async (req, res) => {
  const { date } = req.query;
  try {
    const tableData = await getShiftTable(date);
    res.json({ success: true, data: tableData });
  } catch (error) {
    console.error('Error fetching shift table data:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取交接班表格数据（从handover表查询）
router.get('/handover-table', async (req, res) => {
  const { date } = req.query;
  try {
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const tableData = await getHandoverTableData(date);
    res.json({ success: true, data: tableData });
  } catch (error) {
    console.error('Error fetching handover table data:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取交接班数据失败'
    });
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

// 获取已有交接班日期列表（可访问日期）
router.get('/dates', async (_req, res) => {
  try {
    const dates = await getAvailableDates();
    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('获取可访问日期失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取已有交接班日期列表（宽松模式：支持支付方式0，只要有记录就可选择）
router.get('/dates-flexible', async (_req, res) => {
  try {
    const dates = await getAvailableDatesFlexible();
    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('获取可访问日期失败（宽松模式）:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// 开始交接班（首日默认，已存在则不重复创建）
router.post('/start', async (req, res) => {
  try {
    console.log('收到开始交接班请求:', {
      body: JSON.stringify(req.body, null, 2),
      timestamp: new Date().toISOString()
    });

    // 基本数据验证
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: '请求数据为空'
      });
    }

    const { date, paymentData } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    if (!paymentData) {
      return res.status(400).json({
        success: false,
        message: '缺少支付数据'
      });
    }

    const result = await startHandover(req.body);

    console.log('交接班操作成功完成:', result);

    res.json({
      success: true,
      data: result,
      message: result.message || '交接班成功'
    });

  } catch (error) {
    console.error('开始交接班失败:', {
      message: error.message,
      stack: error.stack,
      requestBody: JSON.stringify(req.body, null, 2)
    });

    // 根据错误类型返回不同的HTTP状态码
    let statusCode = 500;
    if (error.message.includes('格式不正确') || error.message.includes('缺少')) {
      statusCode = 400; // 客户端错误
    } else if (error.message.includes('已存在')) {
      statusCode = 409; // 冲突
    }

    res.status(statusCode).json({
      success: false,
      message: error.message || '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

// 保存页面数据（保存完整的页面数据，包括金额、统计数据等）
router.post('/save-amounts', async (req, res) => {
  try {
    console.log('收到保存页面数据请求:', {
      body: JSON.stringify(req.body, null, 2),
      timestamp: new Date().toISOString()
    });

    // 基本数据验证
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: '请求数据为空'
      });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const result = await saveAmountChanges(req.body);

    console.log('页面数据保存成功:', result);

    res.json({
      success: true,
      data: result,
      message: '页面数据保存成功'
    });

  } catch (error) {
    console.error('保存页面数据失败:', {
      message: error.message,
      stack: error.stack,
      requestBody: JSON.stringify(req.body, null, 2)
    });

    res.status(500).json({
      success: false,
      message: error.message || '保存失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取交接班表中的管理员备忘录
router.get('/admin-memos', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const memos = await getAdminMemosFromHandover(date);
    res.json({
      success: true,
      data: memos,
      message: '获取管理员备忘录成功'
    });
  } catch (error) {
    console.error('获取管理员备忘录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取管理员备忘录失败'
    });
  }
});

// 保存管理员备忘录到交接班表
router.post('/save-admin-memo', async (req, res) => {
  try {
    console.log('收到保存管理员备忘录请求:', {
      body: JSON.stringify(req.body, null, 2),
      timestamp: new Date().toISOString()
    });

    // 基本数据验证
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: '请求数据为空'
      });
    }

    const { date, memo } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    if (!memo || !memo.trim()) {
      return res.status(400).json({
        success: false,
        message: '备忘录内容不能为空'
      });
    }

    const result = await saveAdminMemoToHandover({ date, memo: memo.trim() });

    console.log('管理员备忘录保存成功:', result);

    res.json({
      success: true,
      data: result.data,
      message: result.message || '管理员备忘录保存成功'
    });

  } catch (error) {
    console.error('保存管理员备忘录失败:', {
      message: error.message,
      stack: error.stack,
      requestBody: JSON.stringify(req.body, null, 2)
    });

    res.status(500).json({
      success: false,
      message: error.message || '保存失败',
      timestamp: new Date().toISOString()
    });
  }
});





module.exports = router;
