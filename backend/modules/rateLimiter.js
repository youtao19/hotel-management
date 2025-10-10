"use strict";
const redisDB = require("../database/redis/redis");
const setup = require("../appSettings/setup");
const maxWrongAttemptsByIPperDay = setup.maxWrongAttemptsByIPperDay;
const maxConsecutiveFailsByUsernameAndIP = setup.maxConsecutiveFailsByUsernameAndIP;

// 初始化 Redis 客户端
redisDB.initialize();

// 手动实现的限流器类
class SimpleRateLimiter {
  constructor(keyPrefix, points, duration, blockDuration) {
    this.keyPrefix = keyPrefix;
    this.points = points;
    this.duration = duration;
    this.blockDuration = blockDuration;
  }

  async get(key) {
    const redisClient = redisDB.getClient();
    const fullKey = `${this.keyPrefix}:${key}`;

    try {
      const count = await redisClient.get(fullKey);

      if (!count) {
        return null;
      }

      const ttl = await redisClient.ttl(fullKey);

      return {
        consumedPoints: parseInt(count),
        msBeforeNext: ttl > 0 ? ttl * 1000 : 0,
      };
    } catch (error) {
      console.error('RateLimiter get error:', error);
      return null;
    }
  }

  async consume(key, points = 1) {
    const redisClient = redisDB.getClient();
    const fullKey = `${this.keyPrefix}:${key}`;

    try {
      const count = await redisClient.incrBy(fullKey, points);

      // 如果是第一次设置，设置过期时间
      if (count === points) {
        await redisClient.expire(fullKey, this.blockDuration);
      }

      const ttl = await redisClient.ttl(fullKey);

      // 如果超过限制，抛出错误
      if (count > this.points) {
        const error = new Error('Too Many Requests');
        error.consumedPoints = count;
        error.msBeforeNext = ttl > 0 ? ttl * 1000 : 0;
        throw error;
      }

      return {
        consumedPoints: count,
        msBeforeNext: ttl > 0 ? ttl * 1000 : 0,
        remainingPoints: this.points - count,
      };
    } catch (error) {
      // 如果是我们自己抛出的限流错误，继续抛出
      if (error.consumedPoints) {
        throw error;
      }
      console.error('RateLimiter consume error:', error);
      throw error;
    }
  }

  async delete(key) {
    const redisClient = redisDB.getClient();
    const fullKey = `${this.keyPrefix}:${key}`;

    try {
      await redisClient.del(fullKey);
    } catch (error) {
      console.error('RateLimiter delete error:', error);
    }
  }

  async reward(key, points = 1) {
    const redisClient = redisDB.getClient();
    const fullKey = `${this.keyPrefix}:${key}`;

    try {
      const count = await redisClient.decrBy(fullKey, points);

      // 如果计数降到 0 或以下，删除键
      if (count <= 0) {
        await redisClient.del(fullKey);
      }

      return {
        consumedPoints: Math.max(0, count),
      };
    } catch (error) {
      console.error('RateLimiter reward error:', error);
    }
  }
}

const limiterSlowBruteByIP = new SimpleRateLimiter(
  'login_fail_ip_per_day',
  maxWrongAttemptsByIPperDay,
  60 * 60 * 24,
  60 * 60 * 24 // Block for 1 day
);

const limiterConsecutiveFailsByUsernameAndIP = new SimpleRateLimiter(
  'login_fail_consecutive_username_and_ip',
  maxConsecutiveFailsByUsernameAndIP,
  60 * 60 * 24 * 90,
  60 * 30 // Block for 0.5 hour
);

const getUsernameIPkey = (username, ip) => `${username}_${ip}`;

const rateLimiter = {
  limiterSlowBruteByIP,
  limiterConsecutiveFailsByUsernameAndIP,
  getUsernameIPkey
};

module.exports = rateLimiter;
