
/**
 * 抖音 Token 管理服务 (单例模式)
 */
class DouyinTokenService {
  constructor() {
    // 强烈建议从环境变量 process.env 中读取这些敏感信息
    this.clientKey = process.env.DOUYIN_CLIENT_KEY;
    this.clientSecret = process.env.DOUYIN_CLIENT_SECRET;
    this.tokenUrl = 'https://open.douyin.com/oauth/client_token/';

    this.accessToken = null;
    this.expiresAt = 0; // 记录过期时间戳 (毫秒)

    // 用于防并发刷新的 Promise 锁
    this.refreshPromise = null;
  }

  /**
   * 获取可用 Token。如果即将过期，则自动刷新。
   * @returns {Promise<string>} access_token
   */
  async getToken() {
    const currentTime = Date.now();
    // 缓冲时间：提前 10 分钟 (600,000 毫秒) 触发刷新
    const bufferTime = 10 * 60 * 1000;

    // 1. 如果内存中有 Token，且离过期时间大于 10 分钟，直接秒回缓存
    if (this.accessToken && (this.expiresAt - currentTime > bufferTime)) {
      return this.accessToken;
    }

    // 2. 如果当前已经有其他请求触发了刷新，正在等待抖音响应
    // 那么直接返回那个正在进行中的 Promise，避免重复发请求（防缓存击穿的核心）
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // 3. 否则，发起新的刷新请求，并将这个 Promise 挂载到实例上
    this.refreshPromise = this._refreshTokenFromDouyin().finally(() => {
      // 无论刷新成功还是失败，最后都要把这个锁清空，让后续请求可以重新触发
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /**
   * 真实的 HTTP 请求，去抖音拉取新 Token (内部方法，不建议外部直接调用)
   */
  async _refreshTokenFromDouyin() {
    try {
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

      if (data.message === 'success') {
        const tokenInfo = data.data;
        this.accessToken = tokenInfo.access_token;

        // 抖音返回的 expires_in 是秒，转成毫秒存起来
        const expiresInMs = tokenInfo.expires_in * 1000;
        this.expiresAt = Date.now() + expiresInMs;

        console.log(`[DouyinTokenService] Token 刷新成功, ${tokenInfo.expires_in} 秒后过期。`);
        return this.accessToken;
      } else {
        throw new Error(`获取抖音 Token 失败: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('[DouyinTokenService] 刷新 Token 异常:', error.message);

      // 容灾设计：如果网络抖动刷新失败了，但旧 Token 实际上还没到真正的 0 秒死期
      // 那就把旧的先拿出去顶着用，防止整个业务直接挂掉
      if (this.accessToken && this.expiresAt > Date.now()) {
        console.warn('[DouyinTokenService] 刷新失败，使用即将过期的旧 Token 兜底');
        return this.accessToken;
      }

      throw error; // 真正过期且刷新失败，只能往外抛错让业务层面处理了
    }
  }
}

// 导出单例实例：Node.js 的 require 机制会缓存这个实例
// 这样你在任何文件里引入的都是同一个 tokenService 对象
module.exports = new DouyinTokenService();
