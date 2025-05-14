// 简易API服务器
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// 创建Express应用
const app = express();
const port = 3000;

// 使用中间件
app.use(cors());
app.use(express.json());

// 数据库连接配置
const dbConfig = {
  user: 'postgres',
  password: '1219',
  host: 'localhost',
  port: 5432,
  database: 'hotel_db',
  // 添加超时设置
  connectionTimeoutMillis: 10000, // 连接超时时间设置为10秒
  query_timeout: 10000, // 查询超时时间设置为10秒
  max: 10, // 连接池最大连接数
  idleTimeoutMillis: 30000, // 空闲超时
  retry_on: true // 启用重试连接
};

// 创建数据库连接池
const pool = new Pool(dbConfig);

// 连接测试
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('数据库连接错误:', err);
  } else {
    console.log('数据库连接成功, 时间:', res.rows[0].now);
    // 成功连接后，初始化数据库
    initDb();
  }
});

// 初始化数据库函数
async function initDb() {
  try {
    // 读取并执行初始化SQL文件
    const sqlFile = path.join(__dirname, 'hotel_db_init.sql');
    if (fs.existsSync(sqlFile)) {
      console.log('执行数据库初始化文件...');
      const sql = fs.readFileSync(sqlFile, 'utf8');

      // 分割SQL语句并执行
      const statements = sql
        .replace(/--.*$/gm, '')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        if (stmt.toLowerCase().includes('create database')) {
          console.log('跳过创建数据库命令');
          continue;
        }

        try {
          await pool.query(stmt);
        } catch (e) {
          // 如果表已存在等错误，可以忽略
          console.log('SQL警告:', e.message);
        }
      }
      console.log('数据库初始化完成');
    }
  } catch (error) {
    console.error('数据库初始化错误:', error);
  }
}

// API路由

// 获取所有房型
app.get('/api/room-types', async (req, res) => {
  try {
    console.log('正在处理请求: 获取所有房型');
    const result = await pool.query('SELECT * FROM room_types');
    console.log(`成功获取 ${result.rows.length} 条房型数据`);
    res.json(result.rows);
  } catch (error) {
    console.error('获取房型错误:', error);
    res.status(500).json({
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取所有房间
app.get('/api/rooms', async (req, res) => {
  try {
    console.log('正在处理请求: 获取所有房间');
    const result = await pool.query(`
      SELECT r.*, rt.type_name
      FROM rooms r
      JOIN room_types rt ON r.type_code = rt.type_code
    `);
    console.log(`成功获取 ${result.rows.length} 条房间数据`);
    res.json(result.rows);
  } catch (error) {
    console.error('获取房间错误:', error);
    res.status(500).json({
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取所有订单
app.get('/api/orders', async (req, res) => {
  try {
    console.log('正在处理请求: 获取所有订单');
    const result = await pool.query('SELECT * FROM orders');
    console.log(`成功获取 ${result.rows.length} 条订单数据`);
    res.json(result.rows);
  } catch (error) {
    console.error('获取订单错误:', error);
    res.status(500).json({
      message: '服务器错误',
      error: error.message
    });
  }
});

// 根据ID获取房间
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取房间错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新房间状态
app.patch('/api/rooms/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的房间状态' });
    }

    const result = await pool.query(
      'UPDATE rooms SET status = $1 WHERE room_id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新房间状态错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 启动服务器
app.listen(port, () => {
  console.log(`API服务器运行在 http://localhost:${port}`);
});