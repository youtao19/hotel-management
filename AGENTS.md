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
+ 前端尽量不做逻辑判断（除非 不做逻辑判断就无法完成这个任务），将逻辑都放在后端的 API 中。
+ 你在任何时候都不能修改这个文件 `AGENTS.md` 文件，除非我让你修改
+ 在执行修改时，你需要先查看`业务说明.md`文件，确认业务逻辑。
+ 在任何时候，你都不能修改`业务说明.md`文件，除非我让你修改
+ 你写的任何代码都需要有关键注释
+ commit message 需要用中文书写
+ 代码逻辑要求简单高效。
+ 修改了接口后，需要同步修改接口文档。
+ 函数都需要有规范的注释，包含参数说明、返回值说明、异常说明等。
  

## Node.js 事件处理规范（必须遵守）

1. 禁止对Date字段使用:
- new Date(date)
- toISOString()
DATE 字段在 Node.js 中应:
- 作为字符串直接使用
- 或仅用于格式化展示(如 dayjs(date).format('YYYY-MM-DD'))
2. 对timestamptz字段：
- 不做手动市区换算
- 不加減8小时
- 不使用 toISOString() 直接返回给前端
3. PostgreSQL 驱动(pg / ORM):
- 不强制设置 timezone = 'UTC'
- 依赖数据库 + 会话时区自动转换

当你了解了我的需求后，你也可以逐渐完善我的 `业务说明.md` 文件，来让它更清晰和完整。

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.