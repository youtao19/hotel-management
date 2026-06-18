# JWT 测试修复设计

## 背景

JWT 迁移收口后，审查发现当前失败主要来自测试实现本身，而不是业务鉴权方向：

- `authedRequest()` helper 写成了 `request(app).set(...)`，但 supertest 必须先指定请求方法和路径，导致大量测试报 `request(...).set is not a function`。
- 新增路由鉴权测试放在 `backend/modules/auth/__tests__/`，但它测试的是完整 Express app 路由挂载顺序；当前位置的相对路径错误，且会被全局 setup 当成 auth 单元测试跳过初始化。
- `backend/app.js` 仍有“测试环境下直通”的旧注释，和当前真实 JWT 校验行为不一致。

本设计只修这 3 个测试/注释问题，不改变业务鉴权逻辑。

## 目标

- 保留现有测试里已经使用的 `authedRequest().get(...)`、`authedRequest().post(...)` 写法。
- 让所有使用 `authedRequest()` 的测试自动携带员工测试 JWT。
- 让路由级鉴权测试在真实 app 初始化下运行，并能正确引用 `backend/app.js` 和 `jwt.helper.js`。
- 删除或更新误导性的旧注释。
- `npm run test -- --runInBand` 和 `npm run build` 通过，测试能自然退出。

## 非目标

- 不重新设计测试目录结构。
- 不批量回滚为 `request(app).get(...).set(authHeader())` 写法。
- 不改插件、OTA、前端或 JWT 业务逻辑。
- 不做无关测试风格清理。

## 设计

### 修复 `authedRequest()`

`backend/tests/tools.js` 中的 `authedRequest(accountOverride)` 改成返回一个轻量包装对象，支持常用 HTTP 方法：

- `get(url)`
- `post(url)`
- `put(url)`
- `patch(url)`
- `delete(url)`

每个方法内部执行：

```js
request(app)[method](url).set(authHeader(accountOverride))
```

这样测试可以继续写：

```js
await authedRequest().get('/api/orders')
await authedRequest().post('/api/orders/new').send(payload)
```

而不需要再批量修改几十个测试文件。

### 移动路由鉴权测试

把 `backend/modules/auth/__tests__/auth-routes-protection.test.js` 移到：

```text
backend/tests/auth_routes_protection.test.js
```

原因：

- 这个测试验证的是 `app.js` 的真实挂载顺序，不是 auth 模块单元测试。
- 放在 `backend/tests/` 后，全局 setup 会初始化数据库、Redis 和 Express app。
- 相对路径自然变为 `require('../app')` 和 `require('../modules/auth/jwt.helper')`，不再需要复杂路径。

移动后不需要改 `shouldSkipGlobalBootstrap()` 的 auth 单元测试跳过规则。

### 更新旧注释

`backend/app.js` 中 `/api` 守卫附近的注释改为：

- 测试和真实环境都需要员工 JWT。
- 集成测试通过 `backend/tests/tools.js` 的 `authHeader()` 或 `authedRequest()` 注入 token。

不要保留“测试环境下直通”的描述。

## 验证标准

- 单独运行 `npm --workspace backend run test -- tests/auth_routes_protection.test.js --runInBand` 通过。
- 单独运行一个使用 `authedRequest()` 的代表性测试，例如 `tests/checkIn.test.js` 通过。
- `npm run test -- --runInBand` 通过并自然退出。
- `npm run build` 通过。
- `git diff --check` 通过。
