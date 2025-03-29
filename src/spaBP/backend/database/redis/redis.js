const Redis = require("ioredis");
const setup = require("../../../appSettings/setup");
let db = {};
const redis = {
    getClient: () => {
        return db;
    },
    initialize: () => {
        db = new Redis({
            host: setup.db.redis.host,
            port: setup.db.redis.port,
            enable_offline_queue: false,
            username: "default", // needs Redis >= 6
            password: setup.db.redis.password
        });
    }
};

module.exports = redis;



