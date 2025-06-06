const dbConfig = {
    dev: {
        user: 'postgres',
        password: '1219',
        host: '192.168.31.9',
        port: 5432,
        database: 'hotel_db',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    },
    test: {
        user: 'postgres',
        password: '1219',
        host: '192.168.31.9',
        port: 5432,
        database: 'hotel_db_test',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    }
};

// 获取当前环境的配置
function getConfig() {
    const env = process.env.NODE_ENV || 'dev';
    console.log(`当前环境: ${env}`);
    return dbConfig[env] || dbConfig.dev;
}

module.exports = {
    getConfig
};
