const { createClient } = require("redis");
const setup = require("../../appSettings/setup");

let client = null;
let isInitialized = false;


const redis = {
    initialize: async () => {
        // 只初始化一次，避免创建多个连接
        if (isInitialized && client) {
            console.log('Redis已经初始化，跳过重复初始化');
            return client;
        }

        try {
            client = createClient({
                socket: {
                    host: setup.db.redis.host || 'localhost',
                    port: parseInt(setup.db.redis.port) || 6379
                },
                password: setup.db.redis.password
            });

            client.on('error', (err) => {
                console.error('Redis错误:', err);
            });

            await client.connect();
            isInitialized = true;
            console.log('Redis连接成功');
            return client;
        } catch (error) {
            console.error('Redis初始化失败:', error);
            throw error;
        }
    },

    getClient: () => {
        return client;
    },

    close: async () => {
        if (client && isInitialized) {
            try {
                await client.quit();
                client = null;
                isInitialized = false;
                console.log('Redis连接已关闭');
            } catch (error) {
                console.error('关闭Redis连接失败:', error);
            }
        }
    }
};

module.exports = redis;
