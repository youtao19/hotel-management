const express =  require('express');
const router = express.Router();
const { query } = require('../database/postgreDB/pg');

const {
  getShiftTable,
  getRemarks,
  getShiftSpecialStats,
  startHandover,
  getHandoverTableData,
  saveAdminMemoToHandover,
  getAdminMemosFromHandover,
  checkYesterdayHandoverRecord
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


// 检查昨日交接记录
router.get('/check-yesterday', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const result = await checkYesterdayHandoverRecord(date);
    res.json({
      success: true,
      data: result,
      message: '昨日交接记录检查完成'
    });
  } catch (error) {
    console.error('检查昨日交接记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查昨日交接记录失败'
    });
  }
});

// 查询所有交接班记录
router.get('/query', async (req, res) => {
  try {
    console.log('开始查询交接班记录');

    // 查询所有有完整交接记录的日期
    // 判断标准：一个日期如果包含四种支付方式（1,2,3,4），那么这个日期表示有交接记录
    const sql = `
      SELECT
        date::text as date,
        COUNT(DISTINCT payment_type) as payment_count,
        MIN(handover_person) as handover_person,
        MIN(takeover_person) as takeover_person,
        SUM(CASE WHEN payment_type = 1 THEN vip_card ELSE 0 END) as vip_cards,
        (SELECT task_list FROM handover h2 WHERE h2.date = h1.date AND h2.payment_type = 1 LIMIT 1) as task_list,
        (SELECT remarks FROM handover h3 WHERE h3.date = h1.date AND h3.payment_type = 1 LIMIT 1) as remarks
      FROM handover h1
      WHERE payment_type IN (1, 2, 3, 4)
      GROUP BY date
      HAVING COUNT(DISTINCT payment_type) = 4
      ORDER BY date DESC
    `;

    const result = await query(sql);

    // 格式化返回数据
    const handoverRecords = result.rows.map(row => ({
      date: row.date, // 现在date已经是字符串格式
      handoverPerson: row.handover_person || '',
      takeoverPerson: row.takeover_person || '',
      vipCards: parseInt(row.vip_cards) || 0,
      taskList: row.task_list || [],
      remarks: row.remarks || '',
      paymentCount: parseInt(row.payment_count) || 0
    }));

    console.log(`找到 ${handoverRecords.length} 条交接班记录`);

    res.json({
      success: true,
      data: handoverRecords,
      message: `成功查询到 ${handoverRecords.length} 条交接班记录`
    });

  } catch (error) {
    console.error('查询交接班记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询交接班记录失败'
    });
  }
});

// 根据日期范围查询交接班记录
router.get('/query-by-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('开始按日期范围查询交接班记录:', { startDate, endDate });

    let sql = `
      SELECT
        date::text as date,
        COUNT(DISTINCT payment_type) as payment_count,
        MIN(handover_person) as handover_person,
        MIN(takeover_person) as takeover_person,
        SUM(CASE WHEN payment_type = 1 THEN vip_card ELSE 0 END) as vip_cards,
        (SELECT task_list FROM handover h2 WHERE h2.date = h1.date AND h2.payment_type = 1 LIMIT 1) as task_list,
        (SELECT remarks FROM handover h3 WHERE h3.date = h1.date AND h3.payment_type = 1 LIMIT 1) as remarks
      FROM handover h1
      WHERE payment_type IN (1, 2, 3, 4)
    `;

    const params = [];

    // 如果提供了开始日期
    if (startDate) {
      sql += ` AND date >= $${params.length + 1}::date`;
      params.push(startDate);
    }

    // 如果提供了结束日期
    if (endDate) {
      sql += ` AND date <= $${params.length + 1}::date`;
      params.push(endDate);
    }

    sql += `
      GROUP BY date
      HAVING COUNT(DISTINCT payment_type) = 4
      ORDER BY date DESC
    `;

    const result = await query(sql, params);

    // 格式化返回数据
    const handoverRecords = result.rows.map(row => ({
      date: row.date, // 现在date已经是字符串格式
      handoverPerson: row.handover_person || '',
      takeoverPerson: row.takeover_person || '',
      vipCards: parseInt(row.vip_cards) || 0,
      taskList: row.task_list || [],
      remarks: row.remarks || '',
      paymentCount: parseInt(row.payment_count) || 0
    }));

    console.log(`在指定日期范围内找到 ${handoverRecords.length} 条交接班记录`);

    res.json({
      success: true,
      data: handoverRecords,
      message: `成功查询到 ${handoverRecords.length} 条交接班记录`
    });

  } catch (error) {
    console.error('按日期范围查询交接班记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '按日期范围查询交接班记录失败'
    });
  }
});

// 获取有交接记录的日期列表
router.get('/available-dates', async (req, res) => {
  try {
    console.log('开始查询可用的交接班日期');

    const sql = `
      SELECT date::text as date
      FROM handover
      WHERE payment_type IN (1, 2, 3, 4)
      GROUP BY date
      HAVING COUNT(DISTINCT payment_type) = 4
      ORDER BY date DESC
    `;

    const result = await query(sql);

    const availableDates = result.rows.map(row => row.date); // 现在date已经是字符串格式

    console.log(`找到 ${availableDates.length} 个有交接记录的日期`);

    res.json({
      success: true,
      data: availableDates,
      message: `找到 ${availableDates.length} 个有交接记录的日期`
    });

  } catch (error) {
    console.error('查询可用交接班日期失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询可用交接班日期失败'
    });
  }
});

module.exports = router;
