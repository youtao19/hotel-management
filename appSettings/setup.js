// 加载环境变量
require('dotenv').config({ path: './dev.env' });

//check if there is any missing env
const env = [
  "APP_NAME",
  "APP_URL",
  "OPENAI_KEY",
  "OPENAI_HOST",
  "OPENAI_CHAT_COMPLETION_PATH",
  "NODE_ENV",
  "NODE_PORT",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PW",
  "ADMIN_EMAIL",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PW",
];

for (let envName of env) {
  if (!process.env[envName]) {
    throw new Error(`Missing env : ${envName}`);
  }
}

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
    },
  },
  OPENAI_KEY: process.env.OPENAI_KEY,
  models: {
    gpt35: {
      name: "gpt-3.5-turbo",
      maxTokenCount: 2500,
    },
    "gpt35-16k": {
      name: "gpt-3.5-turbo-16k",
      maxTokenCount: 10000,
    },
    gpt4: {
      name: "gpt-4",
      maxTokenCount: 6000,
    },
    "gpt-4-1106-preview": {
      name: "gpt-4-1106-preview",
      maxTokenCount: 70000,
    },
    "gpt-4-0125-preview": {
      name: "gpt-4-0125-preview",
      maxTokenCount: 120000,
    },
    latest: {
      name: "gpt-4-0125-preview",
      maxTokenCount: 120000,
    },
  },
  task: {
    sampleSizeMax: 22,
  },
  workers: [],
  totalWorkerNum: 20,
};
module.exports = setup;
