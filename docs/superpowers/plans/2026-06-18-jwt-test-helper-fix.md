# JWT Test Helper Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the JWT migration test failures caused by the `authedRequest()` helper shape, misplaced route-protection test, and stale app comment.

**Architecture:** Keep the current JWT business behavior unchanged. Adjust only the test helper contract so existing `authedRequest().get(...)` style works, move the app-level route protection test into the app integration test area, and update the misleading `/api` guard comment.

**Tech Stack:** Node.js, Express, Jest, Supertest, JWT (`jsonwebtoken`)

---

## File Structure

- Modify `backend/tests/tools.js`
  - Owns shared integration-test fixtures and helpers.
  - Update `authedRequest(accountOverride)` to return a small object with HTTP methods that auto-attach `authHeader(accountOverride)`.
- Move `backend/modules/auth/__tests__/auth-routes-protection.test.js` to `backend/tests/auth_routes_protection.test.js`
  - This is an app-level route integration test, not an auth module unit test.
  - Keep its assertions, but use paths relative to `backend/tests/`.
- Modify `backend/app.js`
  - Update only the stale comment above `app.use("/api", authtication.ensureAuthenticated)`.
- Do not modify business JWT behavior in `backend/modules/auth/auth.middleware.js`, `jwt.helper.js`, frontend files, plugin auth, OTA routes, or unrelated tests.

## Task 1: Fix `authedRequest()` Helper

**Files:**
- Modify: `backend/tests/tools.js`
- Test: `backend/tests/checkIn.test.js`

- [ ] **Step 1: Replace the broken helper with a method wrapper**

In `backend/tests/tools.js`, replace the current `authedRequest` function:

```js
/**
 * 创建携带员工 JWT 的 supertest 请求实例。
 * 等价于 `request(app).set(authHeader(accountOverride))`，简洁写法。
 * @param {object} [accountOverride] 覆盖默认测试账号字段
 * @returns {import('supertest').Test} supertest Test 实例
 */
function authedRequest(accountOverride) {
  return request(app).set(authHeader(accountOverride));
}
```

with:

```js
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * 创建携带员工 JWT 的 supertest 请求工厂。
 * supertest 必须先指定 HTTP 方法和路径，才能设置请求头。
 * @param {object} [accountOverride] 覆盖默认测试账号字段
 * @returns {{get:function,post:function,put:function,patch:function,delete:function}} 自动带认证头的请求工厂
 */
function authedRequest(accountOverride) {
  return HTTP_METHODS.reduce((client, method) => {
    client[method] = (url) => request(app)[method](url).set(authHeader(accountOverride));
    return client;
  }, {});
}
```

- [ ] **Step 2: Run a representative failing test**

Run:

```bash
npm --workspace backend run test -- tests/checkIn.test.js --runInBand
```

Expected:

```text
PASS tests/checkIn.test.js
```

If it fails with a business assertion rather than `request(...).set is not a function`, stop and inspect that failure before continuing.

## Task 2: Move Route Protection Test Into App-Level Tests

**Files:**
- Move: `backend/modules/auth/__tests__/auth-routes-protection.test.js` -> `backend/tests/auth_routes_protection.test.js`
- Test: `backend/tests/auth_routes_protection.test.js`

- [ ] **Step 1: Move the test file**

Run:

```bash
mv backend/modules/auth/__tests__/auth-routes-protection.test.js backend/tests/auth_routes_protection.test.js
```

- [ ] **Step 2: Confirm imports are correct after the move**

At the top of `backend/tests/auth_routes_protection.test.js`, keep these imports:

```js
"use strict";

const request = require('supertest');
const app = require('../app');
const { signAccountToken } = require('../modules/auth/jwt.helper');
```

These paths are correct from `backend/tests/`.

- [ ] **Step 3: Run the moved route protection test**

Run:

```bash
npm --workspace backend run test -- tests/auth_routes_protection.test.js --runInBand
```

Expected:

```text
PASS tests/auth_routes_protection.test.js
```

This also proves the file is no longer affected by the `modules/auth/__tests__` global-bootstrap skip rule.

## Task 3: Update Stale `/api` Guard Comment

**Files:**
- Modify: `backend/app.js`

- [ ] **Step 1: Replace the stale comment**

In `backend/app.js`, replace:

```js
    // 员工 JWT 鉴权守卫：所有后续 /api 业务路由需要 Bearer token
    // 测试环境下直通，避免 175+ 集成用例逐个注入 token；JWT 行为由中间件单元测试覆盖
    app.use("/api", authtication.ensureAuthenticated);
```

with:

```js
    // 员工 JWT 鉴权守卫：所有后续 /api 业务路由需要 Bearer token
    // 测试和真实环境走同一套鉴权逻辑，集成测试通过 tools.js 注入测试 token
    app.use("/api", authtication.ensureAuthenticated);
```

- [ ] **Step 2: Check no stale wording remains**

Run:

```bash
rg -n "测试环境下直通|逐个注入 token" backend/app.js backend/modules/auth/auth.middleware.js backend/tests
```

Expected: no matches.

## Task 4: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code `0`.

- [ ] **Step 2: Run backend tests**

Run:

```bash
npm run test -- --runInBand
```

Expected:

```text
Test Suites: 55 passed, 55 total
Tests: 358 passed, 358 total
```

The process should return to the shell without manual `Ctrl-C`.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeded
```

- [ ] **Step 4: Confirm the moved file is staged as a rename/delete-add only once**

Run:

```bash
git status --short
```

Expected:

- No `?? backend/modules/auth/__tests__/auth-routes-protection.test.js`.
- `backend/tests/auth_routes_protection.test.js` exists.
- JWT migration worktree changes remain present.

## Task 5: Commit The Test Fix

**Files:**
- Stage only:
  - `backend/tests/tools.js`
  - `backend/tests/auth_routes_protection.test.js`
  - `backend/modules/auth/__tests__/auth-routes-protection.test.js` deletion, if Git reports it
  - `backend/app.js`

- [ ] **Step 1: Stage the fix**

Run:

```bash
git add backend/tests/tools.js backend/tests/auth_routes_protection.test.js backend/modules/auth/__tests__/auth-routes-protection.test.js backend/app.js
```

- [ ] **Step 2: Review staged files**

Run:

```bash
git diff --cached --name-status
```

Expected staged paths include only:

```text
M	backend/app.js
R or D/A	backend/modules/auth/__tests__/auth-routes-protection.test.js -> backend/tests/auth_routes_protection.test.js
M	backend/tests/tools.js
```

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "test: 修复 JWT 鉴权测试辅助方法" -m "- 修复 authedRequest 让集成测试自动携带员工 JWT\n- 将路由鉴权测试移动到 backend/tests 走真实 app 初始化\n- 更新 app.js 中已过期的测试鉴权注释"
```

Expected: commit succeeds.
