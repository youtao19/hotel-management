# 项目概述：酒店管理系统

本文档旨在提供对酒店管理系统项目的高层次概览，内容涵盖其技术栈、系统架构及核心功能。

## 1. 技术栈

本项目为一个全栈应用，采用了以下技术：

*   **前端:**
    *   框架: [Quasar](https://quasar.dev/) (一个 Vue.js 框架)
    *   语言: JavaScript (ES2022+)
    *   状态管理: [Pinia](https://pinia.vuejs.org/)
    *   HTTP 客户端: [Axios](https://axios-http.com/)
    *   UI 组件: Quasar 框架组件, Material Icons
    *   图表: [Chart.js](https://www.chartjs.org/)

*   **后端:**
    *   框架: [Express.js](https://expressjs.com/) on [Node.js](https://nodejs.org/)
    *   语言: JavaScript
    *   数据库:
        *   主数据库: [PostgreSQL](https://www.postgresql.org/)
        *   缓存: [Redis](https://redis.io/)
    *   认证: 基于 `express-session` 的会话管理，使用 `bcrypt` 进行密码哈希。
    *   邮件服务: [Nodemailer](https://nodemailer.com/)

*   **测试:**
    *   框架: [Jest](https://jestjs.io/)
    *   HTTP 测试: [Supertest](https://github.com/visionmedia/supertest)

*   **开发运维与工具:**
    *   容器化: [Docker](https://www.docker.com/) (`compose.yaml`)
    *   持续集成/持续部署 (CI/CD): [GitHub Actions](https://github.com/features/actions) (`.github/workflows/test.yml`)
    *   开发工具: `nodemon` 用于后端热重载, `concurrently` 用于同时运行前后端服务。
    *   包管理器: `npm` 或 `yarn`。

## 2. 系统架构

本应用采用单体仓库（monorepo）结构，同时包含前端与后端代码。

*   **前端 (`src/` & `frontend/`):** 一个 Quasar 单页应用 (SPA)。
    *   开发服务器运行于 `9000` 端口。
    *   所有 API 请求 (`/api/*`) 都被代理到运行于 `3000` 端口的后端服务器。
    *   代码按页面 (pages)、组件 (components)、状态管理 (stores/Pinia) 和路由 (router) 进行组织。

*   **后端 (`backend/`):** 一个 Node.js/Express.js 应用。
    *   服务器运行于 `3000` 端口。
    *   通过 `/api` 前缀暴露 RESTful API。
    *   代码按路由 (routes)、模块 (modules/业务逻辑) 和数据库访问层进行组织。

*   **数据库 (`backend/database/`):**
    *   使用 PostgreSQL 作为主要的关系型数据库。
    *   数据库结构迁移通过 `backend/database/postgreDB/migrations/` 目录下的脚本进行管理。
    *   Redis 用于缓存或会话存储。

## 3. 核心功能

根据项目文件结构和文档分析，本应用包含以下核心功能：

*   **房间管理:**
    *   配置不同房型，包括价格、设施、图片等详细信息。
    *   支持动态定价（例如，根据季节或日期调整价格）。
    *   查看房间状态（如：可用、入住、打扫中）。

*   **订单管理:**
    *   创建、查看和管理客户预订/订单。

*   **账单与收入:**
    *   为客户住宿生成和管理账单。
    *   跟踪收入并生成统计数据。

*   **交接班:**
    *   专门用于管理员工轮班交接的模块。
    *   包括现金、押金和房态的交接。
    *   支持打印交接班报告和查看历史记录。
    *   包含交接班备忘录和特殊统计功能。

*   **用户管理与认证:**
    *   用户注册与登录。
    *   基于会话的认证机制以保护 API 接口安全。

*   **客户评价:**
    *   用于管理客户评价的系统。

## 4. 如何开始

1.  **安装依赖:**
    ```bash
    npm install
    ```
2.  **运行开发服务器:**
    ```bash
    npm start
    ```
    此命令会同时启动后端服务器（端口 3000）和前端 Quasar 开发服务器（端口 9000）。

3.  **数据库:**
    *   本应用需要一个 PostgreSQL 数据库。
    *   可以使用 `npm run db:init` 和 `npm run db:migrate` 命令分别进行数据库的初始化和迁移。