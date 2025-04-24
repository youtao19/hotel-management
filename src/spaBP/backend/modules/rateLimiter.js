"use strict";
const { RateLimiterRedis } = require('rate-limiter-flexible'); // 引入 rate-limiter-flexible 库
const redisDB = require("../database/redis/redis"); // 引入 Redis 数据库连接模块
const setup = require("../../appSettings/setup"); // 引入应用设置

const redisClient = redisDB.getClient(); // 获取 Redis 客户端实例

// 速率限制器选项基础配置
const limiterOptionsBase = {
    storeClient: redisClient, // 指定 Redis 客户端
    keyPrefix: 'rateLimiter', // Redis 中存储键的前缀
    points: setup.maxWrongAttemptsByIPperDay, // 每个窗口允许的最大点数 (尝试次数)
    duration: 60 * 60 * 24, // 窗口持续时间（秒），这里是 1 天
    blockDuration: 60 * 60 * 24, // 超过限制后阻止的时长（秒），这里是 1 天
};

// 针对 IP 的慢速暴力破解限制器 (限制一天内总的失败次数)
const limiterSlowBruteByIP = new RateLimiterRedis({
    ...limiterOptionsBase,
    keyPrefix: 'rateLimiter_slow_brute_by_ip', // 独立的键前缀
    points: setup.maxWrongAttemptsByIPperDay, // 每天允许的最大错误尝试次数 (针对 IP)
    duration: 60 * 60 * 24, // 窗口期：1 天
    blockDuration: 60 * 60 * 24, // 封锁期：1 天
});

// 针对 用户名+IP 的连续失败限制器 (限制短时间内连续失败次数)
const limiterConsecutiveFailsByUsernameAndIP = new RateLimiterRedis({
    ...limiterOptionsBase,
    keyPrefix: 'rateLimiter_consecutive_username_and_ip', // 独立的键前缀
    points: setup.maxConsecutiveFailsByUsernameAndIP, // 允许的最大连续失败次数 (针对 用户名+IP)
    duration: 60 * 60, // 窗口期：1 小时 (在此期间内计算连续失败)
    blockDuration: 60 * 15, // 封锁期：15 分钟 (连续失败过多后封锁 15 分钟)
});

// 生成 用户名+IP 组合键的辅助函数
const getUsernameIPkey = (username, ip) => `${username}_${ip}`;

module.exports = {
    limiterSlowBruteByIP, // 导出 IP 限制器实例
    limiterConsecutiveFailsByUsernameAndIP, // 导出 用户名+IP 限制器实例
    getUsernameIPkey, // 导出生成组合键的函数
};

