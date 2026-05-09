# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` is a Quasar (Vue 3) SPA. Core code lives in `frontend/src/` with pages, components, stores (Pinia), and router setup.
- `backend/` is an Express app. Key areas: `backend/routes/`, `backend/modules/`, `backend/database/`, and `backend/appSettings/`. Jest tests live in `backend/tests/`.
- `e2e/` contains Playwright specs and helpers (`*.spec.js`), organized by feature folders.
- Root files include `compose.yaml` (Docker), `dev.env` / `dev.env.template` (envs), and `playwright.config.js`.

## Build, Test, and Development Commands
- `npm install` installs workspace dependencies.
- `npm start` runs frontend + backend together (Quasar on `:9000`, API on `:3000`).
- `npm run dev:frontend` / `npm run dev:backend` run each side independently.
- `npm run build` builds the frontend bundle.
- `npm run test` runs backend Jest tests with `.env.test`.
- `npm run test:e2e` runs Playwright E2E; `test:e2e:ui` for interactive mode.
- `npm run db:init` initializes Postgres schema; `npm run db:migrate` applies migrations.

## Coding Style & Naming Conventions
- Indentation is 2 spaces, LF line endings, trailing whitespace trimmed (`.editorconfig`).
- Frontend linting uses ESLint with Vue 3 essentials and Prettier integration (`frontend/.eslintrc.cjs`).
- Test naming: unit/integration tests use `*.test.js`; E2E tests use `*.spec.js`.

## Testing Guidelines
- Jest tests live in `backend/tests/`; run `npm run test:watch` for watch mode or `npm run test:coverage` for coverage.
- Playwright specs live in `e2e/` with config at `playwright.config.js`. Use `npm run test:e2e:debug` for headed debugging.

## Commit & Pull Request Guidelines
- Commit messages in history are short, descriptive, and often in Chinese. Follow that style and include the affected area and tests when relevant (e.g., “修复房间更新校验与房型删除约束，补充测试”).
- PRs should include: a brief summary, test commands run, and screenshots for UI changes. Call out any new env vars, DB migrations, or breaking behavior.

## Security & Configuration Tips
- Copy `dev.env.template` to `dev.env` before local runs and keep secrets out of version control.
- Keep database/Redis credentials consistent with `compose.yaml` when using Docker.


## 要求
+ 前端不承载核心业务规则，业务校验、权限判断、状态流转、数据一致性等逻辑放在后端 API 中；表单交互、按钮禁用、空态展示、加载状态等界面状态逻辑可以保留在前端。
+ 代码注释要求写“为什么这样做”和“需要注意什么”，不要重复代码表面含义。注释应优先说明业务意图、边界条件、兼容性处理、异常原因、时间/金额/权限等容易误解的规则；简单直接、从代码本身即可看懂的内容不写注释。禁止添加“给变量赋值”“遍历数组”“调用接口”这类无信息量注释。注释要简短、准确，并且修改代码时必须同步更新注释，避免注释过期。
+ 修改了接口后，需要同步修改接口文档。
+ 我给了你文档或链接后，你需要按任务上下文保存到仓库约定位置或当前任务记录中，并在需要的时候使用它来帮助你完成任务；如果保存位置不明确，需要先说明你准备保存到哪里。


  

## Node.js 日期时间处理规范（必须遵守）
1. 对 DATE 字段：
- 不把 DATE 当作 UTC 时间处理。
- 不直接使用 toISOString()。
- 优先将 DATE 作为字符串直接使用，例如 `YYYY-MM-DD`。
- 仅在展示时做格式化，例如 `dayjs(dateString).format('YYYY-MM-DD')`。
2. 对 timestamptz 字段：
- 不做手动时区换算。
- 不手动加减小时，例如加减 8 小时。
- 不使用 toISOString() 直接返回给前端。
- 依赖数据库、驱动和会话时区自动转换。
3. PostgreSQL 驱动（pg / ORM）：
- 不强制设置 `timezone = 'UTC'`。
- 保持数据库和会话时区配置一致，由数据库和驱动负责转换。

Always use Context7 MCP when I need third-party library/API documentation, code generation, setup or configuration steps without me having to explicitly ask. If the task depends on project-local code, private interfaces, or existing local documents, prefer the repository context first.

## The Four Principles in Detail
1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

LLMs often pick an interpretation silently and run with it. This principle forces explicit reasoning:

State assumptions explicitly — If uncertain, ask rather than guess
Present multiple interpretations — Don't pick silently when ambiguity exists
Push back when warranted — If a simpler approach exists, say so
Stop when confused — Name what's unclear and ask for clarification
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

Combat the tendency toward overengineering:

No features beyond what was asked
No abstractions for single-use code
No "flexibility" or "configurability" that wasn't requested
No error handling for impossible scenarios
If 200 lines could be 50, rewrite it
The test: Would a senior engineer say this is overcomplicated? If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting
Don't refactor things that aren't broken
Match existing style, even if you'd do it differently
If you notice unrelated dead code, mention it — don't delete it
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused
Don't remove pre-existing dead code unless asked
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

Instead of...	Transform to...
"Add validation"	"Write tests for invalid inputs, then make them pass"
"Fix the bug"	"Write a test that reproduces it, then make it pass"
"Refactor X"	"Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let the LLM loop independently. Weak criteria ("make it work") require constant clarification.

