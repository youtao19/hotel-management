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
+ 你在任何时候都不能修改这个文件 `AGENTS.md` 文件，除非我让你修改
+ 代码注释要求写“为什么这样做”和“需要注意什么”，不要重复代码表面含义。注释应优先说明业务意图、边界条件、兼容性处理、异常原因、时间/金额/权限等容易误解的规则；简单直接、从代码本身即可看懂的内容不写注释。禁止添加“给变量赋值”“遍历数组”“调用接口”这类无信息量注释。注释要简短、准确，并且修改代码时必须同步更新注释，避免注释过期。
+ commit message 需要用中文书写
+ 代码逻辑要求简单高效。
+ 修改了接口后，需要同步修改接口文档。
+ 我给了你文档或链接后，你需要按任务上下文保存到仓库约定位置或当前任务记录中，并在需要的时候使用它来帮助你完成任务；如果保存位置不明确，需要先说明你准备保存到哪里。
+ 你写的 ts 代码不要使用 any 类型；可以使用 unknown 类型，但必须立即做明确的类型收窄，保持严格的类型约束。
+ ts 代码遵守`ts 开发规范.md`中的技术栈要求、项目目标和目录结构要求。

  

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

## qmd 检索规则
在本项目中，如果任务需要查找代码位置、理解跨模块逻辑、定位业务实现、寻找接口/文档/测试，请优先使用 qmd MCP 的 `qmd-hotel-management` 索引检索，再按检索结果读取相关文件。

已知具体文件路径、只需要查看当前 diff、运行测试、格式化、安装依赖、执行 git 命令等任务，不需要使用 qmd。

## 修改代码
+ 你要修改代码的时候，如果是跨模块改动、接口改动、数据结构改动或业务逻辑改动，先将你要修改的详细内容发给我（例如：修改哪个文件、哪个函数、修改的内容是什么），等我确认后，你再进行修改；如果只是小范围、不影响接口和业务规则的局部修复，可以直接修改，但仍要先说明你改了什么。
+ 你写的代码要简单，适合初学者，并且要有必要的关键注释。
