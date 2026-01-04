# Progress

> 说明：每完成一步会同步更新此文件的状态。

## E2E 测试流程（收入统计 & 详细收入数据筛选）

- [ ] 1. 阅读 `业务说明.md`，确认收入统计口径与“详细收入数据”筛选规则
- [ ] 2. 确认现有 E2E 框架与命令（如 Playwright/Cypress）及测试目录结构
- [ ] 3. 导入测试数据：将 `/sql/orders.csv` 导入到测试数据库（记录导入命令/脚本）
- [ ] 4. 准备数据前置校验：确认订单表/账单表数据量、关键日期（2025-11-02 ~ 2025-11-07）
- [ ] 5. 编写 E2E 用例：按日收入统计应分别为
  - 2025-11-02：3115.14
  - 2025-11-03：3233.97
  - 2025-11-04：3462.66
  - 2025-11-05：3675.12
  - 2025-11-06：2891.76
  - 2025-11-07：4845.85
- [ ] 6. 编写 E2E 用例：“详细收入数据”默认展示全部账单；支持按日期+房号筛选；日期默认今日
- [ ] 7. 本地执行 E2E：验证通过并输出关键断言截图/日志（如有）
- [ ] 8. 你确认测试样例（断言点与期望值）后，我再补齐/调整
- [ ] 9. `git add -A`，使用中文 commit message 执行 `git commit -m "..."`

## E2E 测试流程（登录）

- [x] 1. 确认登录页面与成功跳转目标（当前：`/login` -> `/Dash-board`）
- [x] 2. 确认测试账号来源（二选一）：
  - 方案 A：使用现有已验证邮箱账号（你提供 email + 密码）
  - 方案 B：测试前自动插入账号到测试库（globalSetup 里写入 `account`，`email_verified=true`）
- [ ] 3. 确认运行方式（二选一）：
  - 方案 A：你手动启动前后端后再跑 E2E（推荐新手）
  - 方案 B：Playwright `webServer` 自动启动（需要处理 Quasar `devServer.open=true` 的影响）
- [x] 3. 你已选择：方案 A（手动启动），前端地址 `http://localhost:9000`
- [x] 4. 编写用例：访问 `/login`，输入邮箱+密码，点击“登录”，断言进入仪表盘且出现“房间状态概览`（用 `E2E_EMAIL`/`E2E_PASSWORD` 注入）
- [x] 5. 失败调试：开启 trace/screenshot，确保选择器稳定（优先 `getByLabel/getByRole/getByText`）

## E2E 测试一键运行（Playwright）

- [x] 1. 添加脚本：根目录 `package.json` 增加 `test:e2e`
- [x] 2. Playwright 自动启动：`backend/playwright.config.js` 配置 `webServer`（后端 `/api/hup`、前端 `/login`）
- [x] 3. 前端启动不弹窗：`frontend/quasar.config.js` 在 `PLAYWRIGHT=1` 时禁用 `devServer.open`
- [x] 4. 一键验证通过：`npm run test:e2e`
