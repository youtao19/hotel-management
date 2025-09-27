"use strict";
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisDB = require("../database/redis/redis");
const setup = require("../appSettings/setup");
const maxWrongAttemptsByIPperDay = setup.maxWrongAttemptsByIPperDay;
const maxConsecutiveFailsByUsernameAndIP = setup.maxConsecutiveFailsByUsernameAndIP;

// initialize the redis client
redisDB.initialize();

const limiterSlowBruteByIP = new RateLimiterRedis({
  storeClient: redisDB.getClient(),
  keyPrefix: 'login_fail_ip_per_day',
  points: maxWrongAttemptsByIPperDay,
  duration: 60 * 60 * 24,
  blockDuration: 60 * 60 * 24, // Block for 1 day, if 15 wrong attempts per day
});

const limiterConsecutiveFailsByUsernameAndIP = new RateLimiterRedis({
  storeClient: redisDB.getClient(),
  keyPrefix: 'login_fail_consecutive_username_and_ip',
  points: maxConsecutiveFailsByUsernameAndIP,
  duration: 60 * 60 * 24 * 90, // Store number for 90 days since first fail
  blockDuration: 60 * 30, // Block for 0.5 hour
});

const getUsernameIPkey = (username, ip) => `${username}_${ip}`;

const rateLimiter = {
    limiterSlowBruteByIP,
    limiterConsecutiveFailsByUsernameAndIP,
    getUsernameIPkey
};
module.exports = rateLimiter;

