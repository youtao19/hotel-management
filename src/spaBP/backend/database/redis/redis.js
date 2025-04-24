"use strict";
const redis = require('redis'); // 引入 redis 库
const setup = require("../../../appSettings/setup"); // 引入应用设置

// 创建 Redis 客户端实例
const redisClient = redis.createClient({
    url: `redis://${setup.redis.host}:${setup.redis.port}` // Redis 连接 URL
});

// 监听 Redis 客户端错误事件
redisClient.on('error', err => console.error('Redis 客户端错误', err));

// 监听 Redis 客户端连接事件
redisClient.on('connect', () => console.log('成功连接到 Redis 服务器'));

// 监听 Redis 客户端准备就绪事件
redisClient.on('ready', () => console.log('Redis 客户端已准备就绪'));

// 监听 Redis 客户端断开连接事件
redisClient.on('end', () => console.log('Redis 客户端已断开连接'));

// 异步连接 Redis 服务器
async function connectRedis() {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('连接 Redis 时出错:', err);
    }
}

// 导出 Redis 客户端实例和连接函数
module.exports = {
    getClient: () => redisClient, // 导出获取客户端实例的函数
    connectRedis // 导出连接函数
};



