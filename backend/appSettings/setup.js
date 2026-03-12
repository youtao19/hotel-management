// 加载环境变量（兼容 monorepo 后的路径）
const fs = require('fs');
const path = require('path');

//check if there is any missing env
const requiredEnv = [
  "APP_NAME",
  "APP_URL",
  "NODE_ENV",
  "NODE_PORT",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "REDIS_HOST",
  "REDIS_PORT",
  "ADMIN_EMAIL",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PW",
];

// Optional env vars that can be empty
const optionalEnv = [
  "REDIS_PW",
  "OPENAI_KEY",
  "OPENAI_HOST",
  "OPENAI_CHAT_COMPLETION_PATH"
];

for (let envName of requiredEnv) {
  if (!process.env[envName]) {
    throw new Error(`Missing env : ${envName}`);
  }
}

// Set defaults for optional env vars
for (let envName of optionalEnv) {
  if (process.env[envName] === undefined) {
    process.env[envName] = '';
  }
}

const parseListEnv = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return Array.isArray(fallback) ? [...fallback] : [];
};

const autoBillConfig = {
  enabled: String(process.env.AUTO_BILL_ENABLED || '').toLowerCase() !== 'false',
  cron: process.env.AUTO_BILL_CRON || '0 18 * * *',
  timezone: process.env.AUTO_BILL_TZ || 'Asia/Shanghai',
  statusWhitelist: parseListEnv(
    process.env.AUTO_BILL_STATUS_WHITELIST,
    ['pending', 'reserved']
  ),
  alertEmails: (() => {
    const fallback = process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
    const parsed = parseListEnv(process.env.AUTO_BILL_ALERT_EMAILS, fallback);
    return parsed.length > 0 ? parsed : fallback;
  })(),
  monitorWithEmailOnly: true
};

const douyinOutboxJobConfig = {
  enabled: String(process.env.DOUYIN_OUTBOX_JOB_ENABLED || '').toLowerCase() !== 'false',
  cron: process.env.DOUYIN_OUTBOX_JOB_CRON || '*/1 * * * *',
  timezone: process.env.DOUYIN_OUTBOX_JOB_TZ || 'Asia/Shanghai',
  batchSize: Number(process.env.DOUYIN_OUTBOX_JOB_BATCH_SIZE || 10) || 10
};

const setup = {
  opanaiKey: process.env.OPENAI_O_KEY,
  openaiHost: process.env.OPENAI_HOST,
  openaiChatCompPath: process.env.OPENAI_CHAT_COMPLETION_PATH,
  openaiImagePath: process.env.OPENAI_IMAGE_PATH,
  env: process.env.NODE_ENV,
  appName: process.env.APP_NAME,
  sessionSecret: process.env.APP_NAME + "2023",
  appUrl: process.env.APP_URL,
  cookieMaxAge: 1000 * 60 * 60 * 24 * 7 * 2, //2 weeks
  reqSizeLimit: "1mb",
  errorCode: {
    NO_Match: 450,
    PW_INCORRECT: 451,
    CODE_INVALID: 452,
    content_filter: 453,
    no_conv_name: 454,
    email_not_verified: 457,
    rate_limit: 429,
    invalid_key: 430,
  },
  maxWrongAttemptsByIPperDay: 100,
  maxConsecutiveFailsByUsernameAndIP: 6,
  adminEmail: process.env.ADMIN_EMAIL,
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pw: process.env.EMAIL_PW,
  },
  apiRetryTimeout: 3000,
  maxRetries: 3,
  lang: {
    "zh-Hans": "zh-Hans",
    en: "en",
  },
  port: process.env.NODE_PORT,
  db: {
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PW,
    },
    postgres: {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      pw: process.env.POSTGRES_PASSWORD,
      name: process.env.POSTGRES_DB,
      test_name: process.env.POSTGRES_TEST_DB
    },

  },
  task: {
    sampleSizeMax: 22,
  },
  autoBillJob: autoBillConfig,
  douyinOutboxJob: douyinOutboxJobConfig,
  workers: [],
  totalWorkerNum: 20,
  changeType: {
    roomFee: "房费",
    deposit: "收押",
    refundDeposit: "退押",
    supplement: "补收",
    refund: "退款",
  },
};
module.exports = setup;
