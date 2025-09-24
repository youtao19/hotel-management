const Redis = require("ioredis");
const setup = require("../../appSettings/setup");
let db = {};
const redis = {
    getClient: () => {
        return db;
    },
    initialize: () => {
        const redisConfig = {
            host: setup.db.redis.host,
            port: setup.db.redis.port,
            enable_offline_queue: false,
        };

        // 只有在密码不为空时才添加认证信息
        if (setup.db.redis.password && setup.db.redis.password.trim() !== '') {
            redisConfig.username = "default"; // needs Redis >= 6
            redisConfig.password = setup.db.redis.password;
        }

        db = new Redis(redisConfig);

        // 添加错误处理
        db.on('error', (err) => {
            console.error('Redis connection error:', err.message);
        });

        db.on('connect', () => {
            console.log('Redis connected successfully');
        });

        db.on('ready', () => {
            console.log('Redis ready to use');
        });
    }
};

module.exports = redis;



