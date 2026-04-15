/**
 * 文件作用：
 * 测试 getClientToken 函数：
 * 1. 成功时是否返回 access_token
 * 2. 失败时是否抛出业务错误
 * 3. fetch 请求参数是否正确
 */

const fetch = require('node-fetch');
const { getClientToken } = require('../generate-client-token');

/**
 * mock node-fetch 模块
 * 作用：
 * - 不发真实网络请求
 * - 方便控制返回值
 */
jest.mock('node-fetch', () => jest.fn());

/**
 * mock 配置模块
 * 作用：
 * - 避免依赖真实环境变量和真实配置
 * - 保证测试可重复执行
 */
jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    clientKey: 'test_client_key',
    clientSecret: 'test_client_secret',
  },
}));

describe('getClientToken', () => {
  /**
   * 每个测试前清空 mock 调用记录
   * 注意点：
   * - 避免上一个测试的调用次数影响下一个测试
   */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试：接口返回 success 时，应返回 access_token
   */
  test('should return access_token when response is success', async () => {
    // 模拟 fetch 返回的 response 对象
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          message: 'success',
          access_token: 'mock_token_123',
        },
      }),
    });

    const token = await getClientToken();

    expect(token).toBe('mock_token_123');

    // 校验 fetch 是否被正确调用
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://open.douyin.com/oauth/client_token/',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credential',
          client_key: 'test_client_key',
          client_secret: 'test_client_secret',
        }),
      }
    );
  });

  /**
   * 测试：接口业务失败时，应抛出明确错误
   */
  test('should throw error when response message is not success', async () => {
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          message: 'fail',
          description: 'invalid client',
        },
      }),
    });

    await expect(getClientToken()).rejects.toThrow(
      'Failed to get client token: invalid client'
    );
  });

  /**
   * 测试：fetch 本身异常时，应继续向外抛出
   */
  test('should throw error when fetch fails', async () => {
    fetch.mockRejectedValue(new Error('network error'));

    await expect(getClientToken()).rejects.toThrow('network error');
  });
});
