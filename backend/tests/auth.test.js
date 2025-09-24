const request = require('supertest');
const express = require('express');
const session = require('express-session');
const authentication = require('../modules/authentication');
const authRoute = require('../routes/authRouteTest'); // 使用测试专用的路由
const db = require('../database/postgreDB/pg');

// 创建测试专用的app
const testApp = express();
testApp.use(express.json());
testApp.use(express.urlencoded({ extended: true }));

// 简化的session配置
testApp.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

testApp.use(authentication.authenticationMiddleware);
testApp.use('/api/auth', authRoute);

describe('Auth Routes', () => {
  // 测试数据
  const testUser = {
    name: '测试用户',
    email: `test${Date.now()}@example.com`,
    pw: 'testpassword123'
  };

  beforeAll(async () => {
    // 确保数据库连接
    await db.query('SELECT 1');
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await db.query('DELETE FROM account WHERE email = $1', [testUser.email]);
    } catch (e) {
      console.log('清理测试数据失败:', e.message);
    }
  });

  describe('POST /api/auth/signup', () => {
    it('应该成功注册新用户', async () => {
      const response = await request(testApp)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', testUser.name);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).not.toHaveProperty('pw');
    });

    it('应该拒绝重复的邮箱注册', async () => {
      const response = await request(testApp)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('message', '该邮箱已被注册');
    });

    it('应该拒绝无效的输入数据', async () => {
      const invalidUser = {
        name: '测试用户',
        email: 'invalid-email',
        pw: 'test'
      };

      const response = await request(testApp)
        .post('/api/auth/signup')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid input data');
    });
  });

  describe('GET /api/auth/check/email/:email', () => {
    it('应该检查邮箱是否存在', async () => {
      const response = await request(testApp)
        .get(`/api/auth/check/email/${testUser.email}`)
        .expect(200);

      expect(response.body).toHaveProperty('exist', true);
    });

    it('应该返回邮箱不存在', async () => {
      const nonExistentEmail = `nonexistent${Date.now()}@example.com`;
      const response = await request(testApp)
        .get(`/api/auth/check/email/${nonExistentEmail}`)
        .expect(200);

      expect(response.body).toHaveProperty('exist', false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录已注册用户', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          pw: testUser.pw
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', testUser.name);
      expect(response.body).toHaveProperty('email', testUser.email);
    });

    it('应该拒绝错误的密码', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          pw: 'wrongpassword'
        })
        .expect(451);

      expect(response.body).toHaveProperty('message', '用户名或密码错误');
    });

    it('应该拒绝不存在的用户', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          pw: 'password'
        })
        .expect(450);

      expect(response.body).toHaveProperty('message', '用户名或密码错误');
    });

    it('应该拒绝无效的输入数据', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          pw: 'password'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid input data');
    });
  });
});
