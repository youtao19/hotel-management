const express = require('express');
const router = express.Router();
// 使用统一的数据库连接模块
const { query } = require('../database/postgreDB/pg');

// 获取所有房型
router.get('/', async (req, res) => {
  try {
    console.log('获取所有房型请求');

    // 检查room_types表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'room_types'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('room_types表不存在，返回模拟数据');
      // 返回一些模拟数据
      return res.json({
        data: [
          { type_code: 'standard', type_name: '标准间', base_price: 288.00, description: '舒适标准双人间，配备基础设施', is_closed: false },
          { type_code: 'deluxe', type_name: '豪华间', base_price: 388.00, description: '豪华装修双人间，配备高档设施', is_closed: false },
          { type_code: 'suite', type_name: '套房', base_price: 588.00, description: '独立客厅与卧室，尊享舒适空间', is_closed: false },
          { type_code: 'presidential', type_name: '总统套房', base_price: 1288.00, description: '顶级豪华套房，配备全套高端设施与服务', is_closed: false },
          { type_code: 'family', type_name: '家庭房', base_price: 688.00, description: '适合家庭入住的宽敞房间，配备儿童设施', is_closed: false }
        ]
      });
    }

    const { rows } = await query('SELECT * FROM room_types');
    console.log(`成功获取 ${rows.length} 条房型数据`);
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 根据类型代码获取房型
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    console.log(`获取房型代码: ${code}`);

    // 检查room_types表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'room_types'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // 返回模拟数据
      const mockTypes = {
        'standard': { type_code: 'standard', type_name: '标准间', base_price: 288.00, description: '舒适标准双人间，配备基础设施', is_closed: false },
        'deluxe': { type_code: 'deluxe', type_name: '豪华间', base_price: 388.00, description: '豪华装修双人间，配备高档设施', is_closed: false },
        'suite': { type_code: 'suite', type_name: '套房', base_price: 588.00, description: '独立客厅与卧室，尊享舒适空间', is_closed: false },
        'presidential': { type_code: 'presidential', type_name: '总统套房', base_price: 1288.00, description: '顶级豪华套房，配备全套高端设施与服务', is_closed: false },
        'family': { type_code: 'family', type_name: '家庭房', base_price: 688.00, description: '适合家庭入住的宽敞房间，配备儿童设施', is_closed: false }
      };

      if (mockTypes[code]) {
        return res.json({ data: mockTypes[code] });
      } else {
        return res.status(404).json({ message: '未找到房型' });
      }
    }

    const { rows } = await query('SELECT * FROM room_types WHERE type_code = $1', [code]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房型' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
