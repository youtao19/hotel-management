/**
 * 文件作用：
 * 1. 验证旧版 douyinTokenService 的锁释放和锁续期是否使用原子脚本；
 * 2. 验证 expires_in 过小时，Redis 过期时间仍然是合法正整数；
 * 3. 验证直接复用现有 validateDouyinConfig，而不是重复写配置校验。
 */

describe('legacy douyinTokenService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
  });

  /**
   * 构造一个最小可用的服务实例。
   * 说明：
   * - Redis 和配置模块都用 mock，避免访问真实环境；
   * - 每个测试单独 require，防止单例缓存互相污染。
   */
  function loadService(options = {}) {
    const redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      eval: jest.fn(),
      ...options.redisClient,
    };

    const initialize = jest.fn().mockResolvedValue(redisClient);
    const validateDouyinConfig = jest.fn();

    jest.doMock('../../../../database/redis/redis', () => ({
      initialize,
    }));

    jest.doMock('../../../../appSettings/douyin.config', () => ({
      douyinConfig: {
        clientKey: 'test_client_key',
        clientSecret: 'test_client_secret',
      },
      validateDouyinConfig,
    }));

    const service = require('../../../../services/douyinTokenService');

    return {
      service,
      redisClient,
      initialize,
      validateDouyinConfig,
    };
  }

  test('should use minimum safe ttl when expires_in is too small', async () => {
    const { service, redisClient, validateDouyinConfig } = loadService({
      redisClient: {
        set: jest.fn().mockResolvedValue('OK'),
      },
    });

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        message: 'success',
        data: {
          access_token: 'mock_token_123',
          expires_in: 100,
        },
      }),
    });

    const token = await service.refreshTokenFromDouyin();

    expect(token).toBe('mock_token_123');
    expect(validateDouyinConfig).toHaveBeenCalledTimes(1);
    expect(redisClient.set).toHaveBeenCalledWith(
      'douyin:api:access_token',
      'mock_token_123',
      {
        EX: 60,
      }
    );
  });

  test('should release lock with atomic compare-and-delete script', async () => {
    const { service, redisClient } = loadService({
      redisClient: {
        eval: jest.fn().mockResolvedValue(1),
      },
    });

    const result = await service.releaseLock(redisClient, 'lock-value-1');

    expect(result).toBe(1);
    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      {
        keys: ['douyin:api:token_lock'],
        arguments: ['lock-value-1'],
      }
    );
  });

  test('should renew lock with atomic compare-and-expire script', async () => {
    const { service, redisClient } = loadService({
      redisClient: {
        eval: jest.fn().mockResolvedValue(1),
      },
    });

    const result = await service.renewLock(redisClient, 'lock-value-2');

    expect(result).toBe(1);
    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("EXPIRE", KEYS[1], ARGV[2])'),
      {
        keys: ['douyin:api:token_lock'],
        arguments: ['lock-value-2', '10'],
      }
    );
  });

  test('should stop renewal when current request no longer owns the lock', async () => {
    const { service, redisClient } = loadService({
      redisClient: {
        eval: jest.fn().mockResolvedValueOnce(0),
      },
    });

    const timer = service.startLockRenewal(redisClient, 'lock-value-3');

    // 推进定时器，触发第一次续期；返回 0 后应立刻停止后续续期
    await jest.advanceTimersByTimeAsync(service.LOCK_RENEW_INTERVAL_MS + 10);
    await jest.advanceTimersByTimeAsync(service.LOCK_RENEW_INTERVAL_MS + 10);

    expect(redisClient.eval).toHaveBeenCalledTimes(1);

    service.stopLockRenewal(timer);
  });
});
