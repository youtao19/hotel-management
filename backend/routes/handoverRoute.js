const express =  require('express');
const router = express.Router();

const {
  getShiftTable,
  getRemarks,
  getShiftSpecialStats,
  getAvailableDates,
  startHandover,
} = require('../modules/handoverModule');


// 获取交接班表格数据
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
router.get('/available-dates', async (_req, res) => {
  try {
    const dates = await getAvailableDates();
    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('获取可访问日期失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 开始交接班（首日默认，已存在则不重复创建）
router.post('/start', async (req, res) => {
  try{
    const result = await startHandover(req.body)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('开始交接班失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});




module.exports = router;
