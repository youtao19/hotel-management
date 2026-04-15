const { createClient } = require("redis");
const setup = require("../../appSettings/setup");

let client = null;
let initPromise = null; // 并发锁：防止冷启动时多个请求同时触发 createClient

// 将连接逻辑独立为普通函数，避免写在对象的属性值中导致代码嵌套过深
async function connectRedis() {
    try {
        const newClient = createClient({
            socket: {
                host: setup.db.redis.host || 'localhost',
                port: parseInt(setup.db.redis.port) || 6379
            },
            password: setup.db.redis.password
        });

        // 基础错误监听，防止 Redis 断开导致 Node 进程崩溃
        newClient.on('error', function(err) {
            console.error('[Redis] Error:', err);
        });

        await newClient.connect();
        client = newClient;
        return client;

    } catch (error) {
        // 连接失败必须释放锁，否则后续请求会一直卡死
        initPromise = null;
        console.error('[Redis] Connect failed:', error);
        throw error;
    }
}

const redis = {
    async initialize() {
        if (client && client.isReady) {
            return client;
        }

        // 如果已有进程发起了连接，直接等待其结果，防止建立多余的 TCP 连接
        if (initPromise) {
            return await initPromise;
        }

        initPromise = connectRedis();
        return await initPromise;
    },

    getClient() {
        if (!client || !client.isReady) {
            throw new Error('Redis Client is not ready. Call initialize() first.');
        }
        return client;
    },

    async close() {
        if (client) {
            try {
                await client.quit();
                client = null;
                initPromise = null;
            } catch (error) {
                console.error('[Redis] Close failed:', error);
            }
        }
    }
};

module.exports = redis;
