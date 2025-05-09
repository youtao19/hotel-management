const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 数据库连接配置
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'hotel_management',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功:', res.rows[0]);
  }
});

// 中间件
app.use(cors());
app.use(bodyParser.json());

// JWT认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: '令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
};

// 房间相关API
// 获取所有房间
app.get('/api/rooms', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM rooms');
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定ID的房间
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取特定房间号的房间
app.get('/api/rooms/number/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const { rows } = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [number]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('获取房间数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新房间状态
app.patch('/api/rooms/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的房间状态' });
    }

    const { rows } = await pool.query(
      'UPDATE rooms SET status = $1 WHERE room_id = $2 RETURNING *',
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到房间' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新房间状态错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新房间
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { room_number, type_code, status, price } = req.body;

    // 验证必要字段
    if (!room_number || !type_code || !status || !price) {
      return res.status(400).json({ message: '缺少必要字段' });
    }

    // 检查房间号是否已存在
    const checkResult = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: '房间号已存在' });
    }

    // 生成新的room_id (可能需要根据你的需求调整这个逻辑)
    const idResult = await pool.query('SELECT MAX(room_id) as max_id FROM rooms');
    const newId = (idResult.rows[0].max_id || 0) + 1;

    const { rows } = await pool.query(
      'INSERT INTO rooms (room_id, room_number, type_code, status, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [newId, room_number, type_code, status, price]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('添加房间错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取所有房型
app.get('/api/room-types', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM room_types');
    res.json({ data: rows });
  } catch (err) {
    console.error('获取房型数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 订单相关API
// 获取所有订单
app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY create_time DESC');
    res.json({ data: rows });
  } catch (err) {
    console.error('获取订单数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加新订单
app.post('/api/orders', async (req, res) => {
  try {
    // 生成订单号
    const now = new Date();
    const orderPrefix = `O${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    // 获取今天的订单数量
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM orders WHERE order_id LIKE $1 || '%'",
      [orderPrefix]
    );
    const orderCount = parseInt(countResult.rows[0].count) + 1;
    const orderId = `${orderPrefix}${String(orderCount).padStart(3, '0')}`;

    // 准备订单数据
    const {
      guest_name, phone, id_number, room_type, room_number,
      check_in_date, check_out_date, status, payment_method,
      room_price, deposit, remarks
    } = req.body;

    // 默认来源
    const id_source = req.body.id_source || '前台';
    const order_source = req.body.order_source || '线下';

    // 验证必要字段
    if (!guest_name || !phone || !id_number || !room_type || !room_number ||
        !check_in_date || !check_out_date || !status || !room_price) {
      return res.status(400).json({ message: '缺少必要字段' });
    }

    // 插入订单数据
    const { rows } = await pool.query(
      `INSERT INTO orders (
        order_id, id_source, order_source, guest_name, phone, id_number,
        room_type, room_number, check_in_date, check_out_date,
        status, payment_method, room_price, deposit, create_time, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        orderId, id_source, order_source, guest_name, phone, id_number,
        room_type, room_number, check_in_date, check_out_date,
        status, payment_method, room_price, deposit, now, remarks
      ]
    );

    // 如果状态为"已入住"，更新房间状态
    if (status === '已入住') {
      await pool.query(
        'UPDATE rooms SET status = $1 WHERE room_number = $2',
        ['occupied', room_number]
      );
    }
    // 如果状态为"待入住"，更新房间状态为已预订
    else if (status === '待入住') {
      await pool.query(
        'UPDATE rooms SET status = $1 WHERE room_number = $2',
        ['reserved', room_number]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('添加订单错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新订单状态
app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['待入住', '已入住', '已退房', '已取消'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的订单状态' });
    }

    const { rows } = await pool.query(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到订单' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新订单状态错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 办理入住
app.patch('/api/orders/:id/check-in', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkInTime } = req.body;
    const now = checkInTime || new Date();

    // 事务处理
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 更新订单状态
      const orderResult = await client.query(
        'UPDATE orders SET status = $1, actual_check_in_time = $2 WHERE order_id = $3 RETURNING *',
        ['已入住', now, id]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: '未找到订单' });
      }

      // 更新房间状态
      await client.query(
        'UPDATE rooms SET status = $1 WHERE room_number = $2',
        ['occupied', orderResult.rows[0].room_number]
      );

      await client.query('COMMIT');
      res.json({ data: orderResult.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('办理入住错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 办理退房
app.patch('/api/orders/:id/check-out', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkOutTime } = req.body;
    const now = checkOutTime || new Date();

    // 事务处理
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 更新订单状态
      const orderResult = await client.query(
        'UPDATE orders SET status = $1, actual_check_out_time = $2 WHERE order_id = $3 RETURNING *',
        ['已退房', now, id]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: '未找到订单' });
      }

      // 更新房间状态为清洁中
      await client.query(
        'UPDATE rooms SET status = $1 WHERE room_number = $2',
        ['cleaning', orderResult.rows[0].room_number]
      );

      await client.query('COMMIT');
      res.json({ data: orderResult.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('办理退房错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新订单房间信息
app.patch('/api/orders/:id/room', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomType, roomNumber, roomPrice } = req.body;

    // 验证必要字段
    if (!roomType || !roomNumber || !roomPrice) {
      return res.status(400).json({ message: '缺少必要字段' });
    }

    // 事务处理
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 获取当前订单信息
      const currentOrderResult = await client.query(
        'SELECT * FROM orders WHERE order_id = $1',
        [id]
      );

      if (currentOrderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: '未找到订单' });
      }

      const currentOrder = currentOrderResult.rows[0];

      // 如果房间号变了，需要更新原房间和新房间的状态
      if (currentOrder.room_number !== roomNumber) {
        // 如果是已入住状态，则新房间变为已入住，旧房间变为清洁中
        if (currentOrder.status === '已入住') {
          await client.query(
            'UPDATE rooms SET status = $1 WHERE room_number = $2',
            ['cleaning', currentOrder.room_number]
          );

          await client.query(
            'UPDATE rooms SET status = $1 WHERE room_number = $2',
            ['occupied', roomNumber]
          );
        }
        // 如果是待入住状态，则新房间变为已预订，旧房间变为可用
        else if (currentOrder.status === '待入住') {
          await client.query(
            'UPDATE rooms SET status = $1 WHERE room_number = $2',
            ['available', currentOrder.room_number]
          );

          await client.query(
            'UPDATE rooms SET status = $1 WHERE room_number = $2',
            ['reserved', roomNumber]
          );
        }
      }

      // 更新订单房间信息
      const orderResult = await client.query(
        'UPDATE orders SET room_type = $1, room_number = $2, room_price = $3 WHERE order_id = $4 RETURNING *',
        [roomType, roomNumber, roomPrice, id]
      );

      await client.query('COMMIT');
      res.json({ data: orderResult.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('更新订单房间信息错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 库存相关API
// 获取指定日期的库存
app.get('/api/inventory/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { rows } = await pool.query('SELECT * FROM inventory WHERE date = $1', [date]);
    res.json({ data: rows });
  } catch (err) {
    console.error('获取库存数据错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新库存
app.patch('/api/inventory/:date/:typeCode', authenticateToken, async (req, res) => {
  try {
    const { date, typeCode } = req.params;
    const { available_rooms, price_adjustment } = req.body;

    // 验证必要字段
    if (available_rooms === undefined && price_adjustment === undefined) {
      return res.status(400).json({ message: '缺少更新字段' });
    }

    let query = 'UPDATE inventory SET ';
    const values = [];
    let paramCount = 1;

    if (available_rooms !== undefined) {
      query += `available_rooms = $${paramCount++}`;
      values.push(available_rooms);
    }

    if (price_adjustment !== undefined) {
      if (paramCount > 1) query += ', ';
      query += `price_adjustment = $${paramCount++}`;
      values.push(price_adjustment);
    }

    query += ` WHERE date = $${paramCount++} AND type_code = $${paramCount} RETURNING *`;
    values.push(date, typeCode);

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: '未找到库存记录' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('更新库存错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 用户相关API
// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证必要字段
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码是必需的' });
    }

    // 获取用户信息
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const user = userResult.rows[0];

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    // 返回用户信息和令牌
    res.json({
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取当前用户信息
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const username = req.user.id;

    // 获取用户信息
    const { rows } = await pool.query(
      'SELECT username, avatar, role FROM users WHERE username = $1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登出
app.post('/api/auth/logout', (req, res) => {
  // 由于JWT是无状态的，服务器端不需要执行任何操作
  // 客户端需要删除本地存储的令牌
  res.json({ message: '登出成功' });
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
