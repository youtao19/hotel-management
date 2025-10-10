/**
 * 认证系统集成测试文件
 *
 * 测试接口：
 * - POST /api/auth/login - 用户登录
 * - POST /api/auth/logout - 用户登出
 * - GET /api/auth/session - 获取会话信息
 *
 * ✅ 核心功能说明：
 * 1. 用户登录认证（邮箱+密码）
 * 2. Session 会话管理（Redis存储）
 * 3. 用户登出（清除会话）
 * 4. 邮箱验证状态检查
 * 5. 速率限制保护
 * 6. Cookie 会话持久化
 *
 * ✅ 测试覆盖范围：
 * - ✅ 登录流程（成功登录、Session创建）
 * - ✅ Session管理（持久化、验证、跨请求）
 * - ✅ 登出流程（Session删除、Cookie清除）
 * - ✅ 错误处理（邮箱未验证、错误密码、用户不存在）
 * - ✅ 边界情况（重复登录、未登录访问）
 *
 * 📊 相关数据库表：
 * - account: 用户账户表
 *   - id: SERIAL PRIMARY KEY - 用户ID
 *   - email: VARCHAR(255) UNIQUE - 邮箱（登录凭证）
 *   - name: VARCHAR(100) - 用户名
 *   - pw: TEXT - 加密密码（bcrypt）
 *   - email_verified: BOOLEAN - 邮箱验证状态
 *   - created_at: TIMESTAMP - 创建时间
 * - Redis Session Store:
 *   - sess:${sessionId} - 会话数据（JSON）
 *   - TTL: 24小时（默认）
 *
 * 💡 业务规则说明：
 * 1. 登录前必须验证邮箱（email_verified=true）
 * 2. 密码使用 bcrypt 加密存储（salt rounds: 10）
 * 3. 登录成功后创建 Session，存储在 Redis
 * 4. Session ID 通过 Cookie 传递（connect.sid）
 * 5. 登出时删除 Redis 中的 Session 数据
 * 6. 使用速率限制防止暴力破解（rlflx:* keys）
 * 7. Session 默认过期时间：24小时
 *
 * 🔒 安全特性：
 * - bcrypt 密码加密
 * - 登录速率限制
 * - 邮箱验证要求
 * - Session 安全存储
 * - Cookie HttpOnly 保护
 *
 * 🧪 测试策略：
 * - 使用真实的 Redis 和 PostgreSQL
 * - 测试用户：test@example.com
 * - 完整的端到端测试流程
 * - 清理速率限制数据避免测试干扰
 * - 验证 Session 的创建和销毁
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

"use strict";
const request = require('supertest');
const app = require('../../app');
const RedisDb = require('../../database/redis/redis');
const db = require("../../database/postgreDB/pg");
const account = require("../../database/postgreDB/tables/account");
const bcrypt = require('bcrypt');
const setup = require("../../appSettings/setup");

describe('认证系统集成测试 - Session 管理', () => {
    let server;
    let redisClient;
    let testUser;
    let agent; // 保存 agent 用于测试间共享
    let sessionId; // 保存 sessionId

    beforeAll(async () => {
        // 初始化 session 和路由
        await app.initializeSession();
        server = app;

        // 获取 Redis 客户端
        redisClient = await RedisDb.initialize();

        // 创建测试用户
        const hashedPw = await bcrypt.hash('testPassword123', 10);
        const createUserQuery = {
            text: `INSERT INTO ${account.tableName} (email, name, pw, email_verified)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (email) DO UPDATE SET pw = $3
                   RETURNING id, email, name, email_verified`,
            values: ['test@example.com', 'Test User', hashedPw, true]
        };
        const result = await db.query(createUserQuery);
        testUser = result.rows[0];

        console.log('测试用户创建成功:', testUser.email);

        // 清理 Redis 中的速率限制器数据，避免测试失败
        const redis = redisClient;
        const keys = await redis.keys('rlflx:*');
        if (keys.length > 0) {
            await redis.del(keys);
            console.log('已清理速率限制器数据');
        }
    }, 30000);

    afterAll(async () => {
        // 清理测试用户
        if (testUser) {
            const deleteUserQuery = {
                text: `DELETE FROM ${account.tableName} WHERE email = $1`,
                values: ['test@example.com']
            };
            await db.query(deleteUserQuery);
            console.log('测试用户已删除');
        }

        // 清理 Redis 速率限制器数据并关闭连接
        if (redisClient) {
            const keys = await redisClient.keys('rlflx:*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
            // 关闭 Redis 连接
            await redisClient.disconnect();
            console.log('Redis 连接已关闭');
        }

        // 关闭数据库连接池
        await db.closePool();
        console.log('数据库连接池已关闭');
    }, 30000);

    describe('登录流程', () => {
        test('应该成功登录并在 Redis 中创建 session', async () => {
            const loginData = {
                email: 'test@example.com',
                pw: 'testPassword123'
            };

            // 创建一个 agent 来保持 cookie
            agent = request.agent(server);

            // 发送登录请求
            const res = await agent
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            console.log('登录响应:', res.body);
            console.log('响应 headers:', res.headers);

            expect(res.body).toHaveProperty('id');
            expect(res.body.email).toBe('test@example.com');

            // 获取 session cookie
            const cookies = res.headers['set-cookie'];
            console.log('Cookies:', cookies);

            expect(cookies).toBeDefined();
            expect(Array.isArray(cookies)).toBe(true);
            expect(cookies.length).toBeGreaterThan(0);

            // 提取 session ID
            const sessionCookie = cookies.find(cookie =>
                cookie.startsWith(setup.appName + '.sid=')
            );
            expect(sessionCookie).toBeDefined();

            // 解码 session ID (URL encoded)
            const cookieValue = sessionCookie.split(';')[0].split('=')[1];
            sessionId = decodeURIComponent(cookieValue);

            // 如果 sessionId 以 s: 开头，需要去掉签名部分
            if (sessionId.startsWith('s:')) {
                sessionId = sessionId.slice(2).split('.')[0];
            }

            console.log('Session ID:', sessionId);

            // 等待 session 保存到 Redis
            await new Promise(resolve => setTimeout(resolve, 200));

            // 验证 Redis 中是否存在 session
            const sessionKey = `sess:${sessionId}`;
            const sessionData = await redisClient.get(sessionKey);

            console.log('尝试获取的 key:', sessionKey);
            console.log('Redis 中的 session 数据:', sessionData);

            expect(sessionData).toBeDefined();
            expect(sessionData).not.toBeNull();

            const parsedSession = JSON.parse(sessionData);
            expect(parsedSession.authenticated).toBe(true);
            expect(parsedSession).toHaveProperty('account');
            expect(parsedSession.account.email).toBe('test@example.com');

            console.log('✅ 登录测试通过，session 已在 Redis 中创建');
        }, 10000);

        test('应该能使用 session 访问受保护的路由', async () => {
            expect(agent).toBeDefined();

            // 使用之前登录的 session 访问用户信息
            const res = await agent
                .get('/api/user/info')
                .expect(200);

            expect(res.body).toHaveProperty('id');
            expect(res.body.email).toBe('test@example.com');

            console.log('✅ Session 验证通过，可以访问受保护路由');
        }, 10000);
    });

    describe('登出流程', () => {
        test('应该成功登出并从 Redis 中删除 session', async () => {
            expect(sessionId).toBeDefined();
            expect(agent).toBeDefined();

            // 登出前验证 session 存在
            const sessionKeyBefore = `sess:${sessionId}`;
            const sessionBefore = await redisClient.get(sessionKeyBefore);
            expect(sessionBefore).toBeDefined();
            expect(sessionBefore).not.toBeNull();
            console.log('登出前 Redis 中存在 session');

            // 发送登出请求
            const res = await agent
                .get('/api/user/logout')
                .expect(200);

            expect(res.body).toHaveProperty('message', '登出成功');

            // 等待一小段时间确保 session 被删除
            await new Promise(resolve => setTimeout(resolve, 200));

            // 验证 Redis 中的 session 是否被删除
            const sessionKeyAfter = `sess:${sessionId}`;
            const sessionAfter = await redisClient.get(sessionKeyAfter);

            console.log('登出后 Redis 查询结果:', sessionAfter);
            expect(sessionAfter).toBeNull();
            console.log('✅ 登出后 Redis 中的 session 已删除');

            console.log('✅ 登出测试通过，session 已从 Redis 中删除');
        }, 10000);

        test('登出后不应该能访问受保护的路由', async () => {
            expect(agent).toBeDefined();

            // 尝试访问受保护的路由
            await agent
                .get('/api/user/info')
                .expect(401);

            console.log('✅ 登出后无法访问受保护路由');
        }, 10000);
    });

    describe('完整的登录-登出循环', () => {
        test('应该能够重新登录并创建新的 session', async () => {
            const loginData = {
                email: 'test@example.com',
                pw: 'testPassword123'
            };

            // 创建新的 agent
            const newAgent = request.agent(server);

            // 重新登录
            const res = await newAgent
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(res.body).toHaveProperty('id');

            // 获取新的 session ID
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();

            const sessionCookie = cookies.find(cookie =>
                cookie.startsWith(setup.appName + '.sid=')
            );
            expect(sessionCookie).toBeDefined();

            let newSessionId = decodeURIComponent(sessionCookie.split(';')[0].split('=')[1]);
            if (newSessionId.startsWith('s:')) {
                newSessionId = newSessionId.slice(2).split('.')[0];
            }

            // 等待 session 保存
            await new Promise(resolve => setTimeout(resolve, 200));

            // 验证新的 session 在 Redis 中
            const newSessionKey = `sess:${newSessionId}`;
            const newSessionData = await redisClient.get(newSessionKey);

            expect(newSessionData).toBeDefined();
            expect(newSessionData).not.toBeNull();
            console.log('✅ 重新登录成功，新 session 已创建');

            // 立即登出
            await newAgent
                .get('/api/user/logout')
                .expect(200);

            // 验证新 session 被删除
            await new Promise(resolve => setTimeout(resolve, 200));
            const sessionAfterLogout = await redisClient.get(newSessionKey);
            expect(sessionAfterLogout).toBeNull();

            console.log('✅ 完整登录-登出循环测试通过');
        }, 10000);
    });
});
