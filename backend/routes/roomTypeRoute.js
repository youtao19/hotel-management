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
      console.log('room_types表不存在');
    }

    const { rows } = await query('SELECT * FROM room_types ORDER BY type_code');
    console.log(`成功获取 ${rows.length} 条房型数据`);
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
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
      console.log('room_types表不存在');
      return res.status(500).json({ message: '房型表不存在' });
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
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
});

// 添加新房型
router.post('/', async (req, res) => {
  try {
    const { type_code, type_name, base_price, description } = req.body;

    // 验证必要字段
    if (!type_code || !type_name || !base_price) {
      return res.status(400).json({ message: '缺少必要字段: type_code, type_name, base_price' });
    }

    // 检查房型代码是否已存在
    const checkResult = await query('SELECT * FROM room_types WHERE type_code = $1', [type_code]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: '房型代码已存在' });
    }

    // 插入新房型
    const { rows } = await query(
      'INSERT INTO room_types (type_code, type_name, base_price, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [type_code, type_name, base_price, description || null]
    );

    console.log('成功添加房型:', rows[0]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('添加房型错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
});

// 更新房型
router.put('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { type_name, base_price, description } = req.body;

    // 验证必要字段
    if (!type_name || !base_price) {
      return res.status(400).json({ message: '缺少必要字段: type_name, base_price' });
    }

    // 检查房型是否存在
    const checkResult = await query('SELECT * FROM room_types WHERE type_code = $1', [code]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '房型不存在' });
    }

    // 更新房型
    const { rows } = await query(
      'UPDATE room_types SET type_name = $1, base_price = $2, description = $3 WHERE type_code = $4 RETURNING *',
      [type_name, base_price, description || null, code]
    );

    console.log('成功更新房型:', rows[0]);
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新房型错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
});

// 删除房型
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // 检查是否有房间使用此房型
    const roomCheck = await query('SELECT COUNT(*) as count FROM rooms WHERE type_code = $1', [code]);
    if (parseInt(roomCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: '无法删除，还有房间使用此房型' });
    }

    // 检查房型是否存在
    const checkResult = await query('SELECT * FROM room_types WHERE type_code = $1', [code]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '房型不存在' });
    }

    // 删除房型
    await query('DELETE FROM room_types WHERE type_code = $1', [code]);

    console.log('成功删除房型:', code);
    res.json({ message: '房型删除成功' });
  } catch (err) {
    console.error('删除房型错误:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message
    });
  }
});

module.exports = router;
