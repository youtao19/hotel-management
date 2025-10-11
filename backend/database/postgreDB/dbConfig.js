const dbConfig = {
  dev: {
    user: 'peach',
    password: '1219',
    host: 'localhost',
    port: 5432,
    database: 'hotel_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  },
  test: {
    user: 'peach',
    password: '1219',
    host: 'localhost',
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

  const base = dbConfig[env] || dbConfig.dev;

  // test 环境下强制使用内置测试库配置，避免被 dev.env 覆盖
  if (env === 'test') {
    return {
      user: base.user,
      password: base.password,
      host: base.host,
      port: base.port,
      database: base.database,
      max: base.max,
      idleTimeoutMillis: base.idleTimeoutMillis,
      connectionTimeoutMillis: base.connectionTimeoutMillis
    };
  }

  // 非 test 环境允许通过环境变量覆盖，以便容器中可使用服务名连接
  const cfg = {
    user: process.env.POSTGRES_USER || base.user,
    password: process.env.POSTGRES_PASSWORD || base.password,
    host: process.env.POSTGRES_HOST || base.host,
    port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : base.port,
    database: process.env.POSTGRES_DB || base.database,
    max: base.max,
    idleTimeoutMillis: base.idleTimeoutMillis,
    connectionTimeoutMillis: base.connectionTimeoutMillis
  };

  return cfg;
}

module.exports = {
  getConfig
};
