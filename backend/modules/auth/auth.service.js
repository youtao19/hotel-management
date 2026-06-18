"use strict";

const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");
const redisDB = require("../../database/redis/redis");
const setup = require("../../appSettings/setup");
const emailJob = require("../emailSetup");
const {
  limiterSlowBruteByIP,
  limiterConsecutiveFailsByUsernameAndIP,
  getUsernameIPkey
} = require("../rateLimiter");
const repository = require("./auth.repository");

const saltRounds = 10;

async function signup({ name, email, pw }) {
  const hash = await bcrypt.hash(pw, saltRounds);
  const result = await repository.createAccount({ name, email, passwordHash: hash });

  if (result.rows.length !== 1) {
    throw new Error("no account created!");
  }

  const { id, name: accountName, email: accountEmail } = result.rows[0];
  return { id, name: accountName, email: accountEmail };
}

async function consumeLimiters(limiters) {
  try {
    await Promise.all(limiters);
    return null;
  } catch (rlRejected) {
    if (rlRejected instanceof Error) {
      throw rlRejected;
    }

    return Math.round(rlRejected.msBeforeNext / 1000) || 1;
  }
}

async function login({ email, pw, ipAddr }) {
  const usernameIPkey = getUsernameIPkey(email, ipAddr);
  const [resUsernameAndIP, resSlowByIP] = await Promise.all([
    limiterConsecutiveFailsByUsernameAndIP.get(usernameIPkey),
    limiterSlowBruteByIP.get(ipAddr)
  ]);

  let retrySecs = 0;

  if (resSlowByIP !== null && resSlowByIP.consumedPoints > setup.maxWrongAttemptsByIPperDay) {
    retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1;
  } else if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > setup.maxConsecutiveFailsByUsernameAndIP) {
    retrySecs = Math.round(resUsernameAndIP.msBeforeNext / 1000) || 1;
  }

  if (retrySecs > 0) {
    return { status: setup.errorCode.rate_limit, retryAfter: retrySecs, text: "Too Many Requests" };
  }

  const result = await repository.findAccountByEmail(email);
  if (result.rows.length === 0) {
    const retryAfter = await consumeLimiters([limiterSlowBruteByIP.consume(ipAddr)]);
    if (retryAfter) {
      return { status: setup.errorCode.rate_limit, retryAfter, text: "Too Many Requests" };
    }

    return { status: setup.errorCode.NO_Match, body: undefined };
  }

  const account = result.rows[0];
  const match = await bcrypt.compare(pw, account.pw);
  if (!match) {
    const retryAfter = await consumeLimiters([
      limiterSlowBruteByIP.consume(ipAddr),
      limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)
    ]);
    if (retryAfter) {
      return { status: setup.errorCode.rate_limit, retryAfter, text: "Too Many Requests" };
    }

    return { status: setup.errorCode.PW_INCORRECT, body: undefined };
  }

  if (!account.email_verified) {
    // 未验证邮箱仍计入失败次数，避免绕过登录限流。
    const retryAfter = await consumeLimiters([
      limiterSlowBruteByIP.consume(ipAddr),
      limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)
    ]);
    if (retryAfter) {
      return { status: setup.errorCode.rate_limit, retryAfter, text: "Too Many Requests" };
    }

    return { status: setup.errorCode.email_not_verified, body: undefined };
  }

  const loggedInAccount = {
    id: account.id,
    name: account.name,
    email: account.email
  };

  if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > 0) {
    await limiterConsecutiveFailsByUsernameAndIP.delete(usernameIPkey);
  } else if (resSlowByIP !== null && resSlowByIP.consumedPoints > 0) {
    await limiterSlowBruteByIP.delete(ipAddr);
  }

  return { status: 200, body: loggedInAccount };
}

async function scanRedisValues(pattern) {
  const redis = redisDB.getClient();
  const values = [];
  let cursor = "0";

  do {
    const result = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: 100
    });
    cursor = result.cursor;

    if (result.keys && result.keys.length > 0) {
      const scannedValues = await redis.mGet(result.keys);
      values.push(...scannedValues);
    }
  } while (cursor !== "0");

  return values;
}

async function sendEmailVerification(email) {
  const result = await repository.findAccountByEmail(email);
  if (result.rows.length === 0) {
    console.log("email not in our system. The user is trying to send req directly without using browser! api is sending email verification");
    return { status: 400, end: true };
  }

  const existingEmails = await scanRedisValues("emailVerification*");
  if (existingEmails.indexOf(email) !== -1) {
    console.log(`${email} is trying to verify email within 10 mins more than once.`);
    return { status: setup.errorCode.rate_limit, end: true };
  }

  const redis = redisDB.getClient();
  const code = nanoid();
  await redis.set(`emailVerification${code}`, email, { EX: 600 });
  await emailJob.sendEmailVerification(code, email, "zh-Hans");
  return { status: 200, body: undefined };
}

async function verifyEmail(code) {
  const redis = redisDB.getClient();
  const email = await redis.get(`emailVerification${code}`);
  if (!email) {
    return { status: setup.errorCode.CODE_INVALID, body: undefined };
  }

  await repository.markEmailVerified(email);
  await redis.del(`emailVerification${code}`);
  return { status: 200, body: undefined };
}

async function checkEmail(email) {
  const result = await repository.findEmail(email);
  return { exist: result.rows.length !== 0 };
}

async function sendResetPasswordEmail(email) {
  const result = await repository.findAccountByEmail(email);
  if (result.rows.length === 0) {
    console.log("email not in our system. The user is trying to send req directly without using browser!");
    return { status: 400, body: undefined };
  }

  const existingEmails = await scanRedisValues("resetPassword*");
  if (existingEmails.indexOf(email) !== -1) {
    console.log(`${email} is trying to send reset pw email within 1 hour more than once.`);
    return { status: setup.errorCode.rate_limit, body: undefined };
  }

  const redis = redisDB.getClient();
  const code = nanoid();
  await redis.set(`resetPassword${code}`, email, { EX: 3600 });
  await emailJob.sendResetPWEmail(code, email, setup.lang["zh-Hans"]);
  return { status: 200, body: undefined };
}

async function resetPassword({ pw, code }) {
  const redis = redisDB.getClient();
  const email = await redis.get(`resetPassword${code}`);
  if (!email) {
    return { status: setup.errorCode.CODE_INVALID, body: undefined };
  }

  const hash = await bcrypt.hash(pw, saltRounds);
  await repository.updatePasswordByEmail({ email, passwordHash: hash });
  await redis.del(`resetPassword${code}`);
  return { status: 200, body: undefined };
}

async function checkResetCode(code) {
  const redis = redisDB.getClient();
  const email = await redis.get(`resetPassword${code}`);
  return { exist: !!email };
}

async function getCurrentUser(accountId) {
  const result = await repository.findAccountInfoById(accountId);
  return result.rows;
}

async function getCurrentUserEmailVerified(accountId) {
  const result = await repository.findEmailVerifiedByAccountId(accountId);
  return result.rows[0];
}

module.exports = {
  checkEmail,
  checkResetCode,
  getCurrentUser,
  getCurrentUserEmailVerified,
  login,
  resetPassword,
  sendEmailVerification,
  sendResetPasswordEmail,
  signup,
  verifyEmail
};
