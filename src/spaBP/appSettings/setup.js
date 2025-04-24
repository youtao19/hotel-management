"use strict";
require('dotenv').config({ path: './dev.env' }); // 加载 .env 文件中的环境变量

// 应用全局设置
const setup = {
    appName: process.env.APP_NAME || "酒店管理系统", // 应用名称
    appUrl: process.env.APP_URL || "http://localhost:9000", // 前端应用 URL (Quasar dev server)
    port: process.env.PORT || 3001, // 后端服务器端口
    isProduction: process.env.NODE_ENV === 'production', // 是否为生产环境
    adminEmail: process.env.ADMIN_EMAIL || "admin@example.com", // 管理员邮箱

    // Session 设置
    sessionSecret: process.env.SESSION_SECRET || "a_very_strong_secret_key", // Session 密钥，生产环境必须修改
    sessionMaxAge: 1000 * 60 * 60 * 24 * 7, // Session 有效期 (7 天)

    // PostgreSQL 数据库设置
    pg: {
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "hotel_management",
        password: process.env.PG_PASSWORD || "1219", // 生产环境必须修改
        port: process.env.PG_PORT || 5432,
    },

    // Redis 设置
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        // password: process.env.REDIS_PASSWORD // 如果 Redis 需要密码
    },

    // 邮件服务设置 (例如使用 Mailtrap 或真实 SMTP 服务商)
    email: {
        host: process.env.EMAIL_HOST || "sandbox.smtp.mailtrap.io",
        port: process.env.EMAIL_PORT || 2525,
        user: process.env.EMAIL_USER || "your_mailtrap_user", // 生产环境必须修改
        pw: process.env.EMAIL_PW || "your_mailtrap_password", // 生产环境必须修改
    },

    // 速率限制设置
    maxWrongAttemptsByIPperDay: process.env.MAX_WRONG_ATTEMPTS_IP_DAY || 100, // 单个 IP 每天最大错误尝试次数
    maxConsecutiveFailsByUsernameAndIP: process.env.MAX_CONSECUTIVE_FAILS_USER_IP || 5, // 单个 用户名+IP 最大连续失败次数

    // 错误代码定义 (可选，用于标准化错误响应)
    errorCode: {
        rate_limit: 429,
        NO_Match: 401, // 邮箱或密码不匹配
        PW_INCORRECT: 401, // 密码不正确 (与 NO_Match 合并)
        CODE_INVALID: 400, // 验证码无效
        EMAIL_NOT_VERIFIED: 403, // 邮箱未验证
    },

    // 语言设置 (示例)
    lang: {
        'zh-Hans': 'zh-Hans',
        'en': 'en'
    }
};

module.exports = setup; // 导出设置对象