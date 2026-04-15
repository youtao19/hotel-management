const { randomUUID } = require('crypto');
const redis = require('../database/redis/redis'); // 使用实际存在的 Redis 模块
const { douyinConfig, validateDouyinConfig } = require('../appSettings/douyin.config');

class DouyinTokenService {
    constructor() {
        this.clientKey = douyinConfig.clientKey || process.env.DOUYIN_CLIENT_KEY;
        this.clientSecret = douyinConfig.clientSecret || process.env.DOUYIN_CLIENT_SECRET;
        this.tokenUrl = 'https://open.douyin.com/oauth/client_token/';

        // 增加专属前缀，防止把系统现有的 Session 缓存覆盖掉
        this.TOKEN_KEY = 'douyin:api:access_token';
        this.LOCK_KEY = 'douyin:api:token_lock';
        this.LOCK_EXPIRE_SECONDS = 10;
        this.LOCK_RENEW_INTERVAL_MS = 3000;
    }

    async getToken() {
        const redisClient = await redis.initialize();

        let token = await redisClient.get(this.TOKEN_KEY);
        if (token) {
            return token;
        }

        // Node-Redis v4 语法的分布式锁
        // EX: 10 秒超时，防止执行刷新期间当前进程意外挂掉导致死锁
        // NX: true 保证同一瞬间只有第一个执行的请求能设置成功
        // 每次生成唯一锁值，避免误删其他请求后续拿到的新锁
        const lockValue = this.createLockValue();
        const lock = await redisClient.set(this.LOCK_KEY, lockValue, {
            EX: this.LOCK_EXPIRE_SECONDS,
            NX: true
        });

        if (lock === 'OK') {
            const renewalTask = this.startLockRenewal(redisClient, lockValue);
            try {
                // 抢到锁后二次检查，防止排队期间被别的实例刷好了
                token = await redisClient.get(this.TOKEN_KEY);
                if (token) {
                    return token;
                }

                token = await this.refreshTokenFromDouyin();
                return token;
            } finally {
                this.stopLockRenewal(renewalTask);
                // 只删除属于当前请求自己的锁，避免误删其他请求的新锁
                await this.releaseLock(redisClient, lockValue);
            }
        } else {
            // 未抢到锁，等待 500ms 后重新进入拿 Token 的流程
            await this.delay(500);
            return await this.getToken();
        }
    }

    async refreshTokenFromDouyin() {
        // 直接复用现有配置校验，缺少密钥时尽早抛出明确错误
        validateDouyinConfig();

        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_key: this.clientKey,
                client_secret: this.clientSecret,
                grant_type: 'client_credential'
            })
        });

        const data = await response.json();

        if (data.message === 'success' && data.data && data.data.access_token) {
            const accessToken = data.data.access_token;
            const expiresIn = Number(data.data.expires_in);

            // 强行扣减 600 秒（10分钟），避免业务刚拿到 Token 就在传输途中过期
            // 如果上游返回异常值，至少保留 60 秒，避免 Redis 因非法 EX 报错
            const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 0
                ? Math.max(60, Math.floor(expiresIn) - 600)
                : 60;

            const redisClient = await redis.initialize();
            await redisClient.set(this.TOKEN_KEY, accessToken, {
                EX: safeExpiresIn
            });

            return accessToken;
        } else {
            throw new Error(`Douyin Token Request Failed: ${JSON.stringify(data)}`);
        }
    }

    createLockValue() {
        return `douyin-token-lock:${process.pid}:${Date.now()}:${randomUUID()}`;
    }

    startLockRenewal(redisClient, lockValue) {
        let isRenewing = false;

        const timer = setInterval(async () => {
            if (isRenewing) {
                return;
            }

            isRenewing = true;

            try {
                const renewResult = await this.renewLock(redisClient, lockValue);

                // 锁已不属于当前请求时，立即停止续期，避免无意义轮询
                if (renewResult !== 1) {
                    this.stopLockRenewal(timer);
                }
            } catch (error) {
                console.error('[DouyinTokenService] Renew lock failed:', error);
                this.stopLockRenewal(timer);
            } finally {
                isRenewing = false;
            }
        }, this.LOCK_RENEW_INTERVAL_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }

        return timer;
    }

    stopLockRenewal(timer) {
        if (timer) {
            clearInterval(timer);
        }
    }

    async renewLock(redisClient, lockValue) {
        return Number(await redisClient.eval(
            `if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("EXPIRE", KEYS[1], ARGV[2])
            end
            return 0`,
            {
                keys: [this.LOCK_KEY],
                arguments: [lockValue, String(this.LOCK_EXPIRE_SECONDS)]
            }
        ));
    }

    async releaseLock(redisClient, lockValue) {
        return Number(await redisClient.eval(
            `if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end
            return 0`,
            {
                keys: [this.LOCK_KEY],
                arguments: [lockValue]
            }
        ));
    }

    // 辅助延时函数，替代嵌套的 setTimeout
    delay(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = new DouyinTokenService();
