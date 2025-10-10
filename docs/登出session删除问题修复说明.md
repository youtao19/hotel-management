# 登出 Session 删除问题修复说明

## 问题描述

用户反馈：登录时可以正确创建 session，但是登出不会删除 session。

## 问题根源

经过调试和分析，发现问题出在 **Session Cookie 配置不一致**：

### 1. Cookie 创建和清除参数不匹配

在 `backend/app.js` 的 session 配置中：

```javascript
// ❌ 原始配置（有问题）
cookie: {
    secure: setup.env !== "dev",  // dev: false, test: true, production: true
    maxAge: setup.cookieMaxAge,
    sameSite: setup.env === "dev" ? "lax" : "none",  // dev: "lax", test/production: "none"
    httpOnly: true
}
```

**问题**：
- 测试环境 (`NODE_ENV=test`) 时，`setup.env !== "dev"` 返回 `true`
- 导致 `secure: true` 和 `sameSite: "none"`
- HTTP 请求下，浏览器/测试环境不接受 `secure: true` 的 cookie
- 登出时使用不同的配置参数清除 cookie，导致清除失败

### 2. 环境判断逻辑错误

原代码使用 `setup.env !== "dev"` 来判断是否为生产环境，但这会把测试环境也当作生产环境处理。

## 解决方案

### 1. 修复 `backend/app.js` 中的 session 配置

```javascript
// ✅ 修复后的配置
const sessionOptions = {
    name: setup.appName + ".sid",
    store: new RedisStore({ client: redisClient }),
    secret: setup.sessionSecret,
    resave: false,
    rolling: false,
    cookie: {
        secure: setup.env === "production",  // 只有生产环境才用 true
        maxAge: setup.cookieMaxAge,
        sameSite: setup.env === "production" ? "none" : "lax",  // 生产环境用 none，其他用 lax
        httpOnly: true
    },
    saveUninitialized: false,
};

if (setup.env === "production") {
    sessionOptions.proxy = true;
    app.set("trust proxy", true);
}
```

**关键改动**：
- `secure` 只在生产环境为 `true`
- `sameSite` 只在生产环境为 `"none"`，开发和测试环境为 `"lax"`
- proxy 配置只在生产环境启用

### 2. 修复 `backend/routes/userRoute.js` 中的登出路由

```javascript
// ✅ 修复后的登出逻辑
router.get("/logout", async (req, res, next) => {
    try {
        const cookieName = setup.appName + ".sid";

        if (req.session && req.logout) {
            await req.logout();
        } else if (req.session) {
            // 手动清理 session
            await new Promise((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destroy 失败:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // 清除 cookie（参数必须与创建时一致！）
        res.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            sameSite: setup.env === "production" ? "none" : "lax",
            secure: setup.env === "production"
        });

        return res.status(200).json({ message: '登出成功' });
    } catch (e) {
        console.error('登出操作失败:', e);

        // 即使失败也清除 cookie
        const cookieName = setup.appName + ".sid";
        res.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            sameSite: setup.env === "production" ? "none" : "lax",
            secure: setup.env === "production"
        });

        return res.status(200).json({ message: '登出完成' });
    }
});
```

**关键改动**：
- `clearCookie` 的参数与创建 cookie 时完全一致
- 使用 `setup.env === "production"` 而不是 `setup.env !== "dev"`
- 添加错误处理，确保即使登出失败也清除 cookie

## 测试验证

创建了完整的测试文件 `backend/test/auth.test.js`，包括：

1. **登录流程测试**：
   - 验证登录成功
   - 验证 Redis 中创建了 session
   - 验证可以使用 session 访问受保护路由

2. **登出流程测试**：
   - 验证登出成功
   - **验证 Redis 中的 session 被删除**（核心测试）
   - 验证 cookie 被清除
   - 验证登出后无法访问受保护路由

3. **完整循环测试**：
   - 测试重新登录和登出的完整流程

测试结果：
```
✓ 应该成功登录并在 Redis 中创建 session
✓ 应该能使用 session 访问受保护的路由
✓ 应该成功登出并从 Redis 中删除 session
✓ 登出后不应该能访问受保护的路由
✓ 应该能够重新登录并创建新的 session

Test Suites: 1 passed
Tests:       5 passed
```

## 关键要点

### Cookie 清除规则

`res.clearCookie()` 必须提供与 `Set-Cookie` 时**完全相同**的选项：
- `path`
- `domain`
- `secure`
- `sameSite`
- `httpOnly`

如果参数不匹配，浏览器会认为这是两个不同的 cookie，清除操作会失败。

### 环境配置

- **开发环境** (`NODE_ENV=dev`): `secure: false`, `sameSite: "lax"`
- **测试环境** (`NODE_ENV=test`): `secure: false`, `sameSite: "lax"`
- **生产环境** (`NODE_ENV=production`): `secure: true`, `sameSite: "none"`, `proxy: true`

### SameSite 说明

- `"lax"`: 适用于同站点请求，兼容性好
- `"none"`: 允许跨站点请求，但必须配合 `secure: true` 使用
- `"strict"`: 最严格，仅限完全同站点

## 修改文件清单

1. `backend/app.js` - 修复 session 配置
2. `backend/routes/userRoute.js` - 修复登出路由
3. `backend/test/auth.test.js` - 新增测试文件

## Jest 退出问题修复

测试完成后 Jest 无法退出的原因是异步连接未关闭：

```javascript
afterAll(async () => {
    // 清理测试用户
    if (testUser) {
        await db.query(deleteUserQuery);
    }

    // 关闭 Redis 连接
    if (redisClient) {
        await redisClient.disconnect();  // ✅ 使用 disconnect()
    }

    // 关闭数据库连接池
    await db.closePool();  // ✅ 关闭连接池
}, 30000);
```

**关键点**：
- Redis 使用 `disconnect()` 而不是 `quit()`
- 数据库使用 `db.closePool()` 关闭连接池
- 确保所有异步资源都被清理

## 后续建议

1. 考虑在其他环境（如 staging）中也使用合适的配置
2. 可以考虑将 cookie 配置提取到 `setup.js` 中统一管理
3. 定期运行测试确保 session 管理功能正常

---

**修复日期**：2025年10月10日
**测试状态**：✅ 通过
