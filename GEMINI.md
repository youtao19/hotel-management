# GEMINI 项目分析

## 项目概述

本项目是一个全栈酒店管理系统。它提供一个基于 Web 的用户界面，用于管理房间、订单、账单和员工交接班。

**主要技术:**

*   **前端:** Quasar (一个 Vue.js 框架)，使用 Pinia 进行状态管理。
*   **后端:** Node.js 与 Express.js。
*   **数据库:** PostgreSQL 作为主数据库，Redis 用于缓存/会话。
*   **认证:** 使用 `express-session` 进行基于会话的认证。
*   **测试:** Jest 用于单元和集成测试。
*   **DevOps:** Docker 用于容器化，GitHub Actions 用于 CI/CD。

**架构:**

该项目是一个包含前端和后端代码的单体仓库 (monorepo)。

*   **前端 (`frontend/`):** 一个 Quasar 单页应用 (SPA)，在开发模式下运行于端口 9000。它通过 API 调用与后端通信。
*   **后端 (`backend/`):** 一个 Node.js/Express.js 应用，运行于端口 3000。它通过 `/api` 前缀暴露 RESTful API。

## 构建和运行

**1. 安装依赖:**

```bash
npm install
```

**2. 开发模式下运行:**

```bash
npm start
```

此命令会同时启动前端和后端开发服务器。前端将通过 `http://localhost:9000` 访问，后端将通过 `http://localhost:3000` 访问。

**3. 运行测试:**

```bash
npm test
```

此命令将运行 Jest 测试套件。

**4. 数据库初始化和迁移:**

*   **初始化数据库:**
    ```bash
    npm run db:init
    ```
*   **运行数据库迁移:**
    ```bash
    npm run db:migrate
    ```

## 开发约定

*   **代码风格:** 项目使用 `.editorconfig` 来保持一致的编码风格。
*   **API 路由:** 所有 API 路由都在 `backend/routes/` 目录中定义，并以 `/api` 为前缀。
*   **前端组件:** 前端被组织成页面 (pages)、组件 (components) 和状态管理 (stores/Pinia)。
*   **状态管理:** 使用 Pinia 进行全局状态管理，状态存储在 `src/stores/` 目录中。
*   **环境变量:** 使用 `.env` 文件来配置环境变量。
