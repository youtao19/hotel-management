const Redis = require("ioredis");
const setup = require("../../appSettings/setup");
let db = null;
let isInitialized = false;

const redis = {
    initialize: () => {
        // 只初始化一次，避免创建多个连接
        if (isInitialized && db) {
            console.log('Redis已经初始化，跳过重复初始化');
            return db;
        }

        db = new Redis({
            host: setup.db.redis.host,
            port: setup.db.redis.port,
            enable_offline_queue: false,
            username: "default", // needs Redis >= 6
            password: setup.db.redis.password
        });
        isInitialized = true;
        return db;
    },
    getClient: () => {
      return db;
    },
    close: async () => {
        if (db && db.disconnect) {
            // 使用 disconnect 而不是 quit，立即关闭连接
            db.disconnect();
            db = null;
            isInitialized = false;
            console.log('Redis连接已关闭');
        }
    }
};

module.exports = redis;



