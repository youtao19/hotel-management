# 项目概述：酒店管理系统

本文档旨在提供对酒店管理系统项目的高层次概览，内容涵盖其技术栈、系统架构及核心功能。

## 🌍 跨平台支持

本项目完全支持在以下平台运行：
- ✅ **macOS** (Intel & Apple Silicon)
- ✅ **Linux** (Ubuntu, Debian, CentOS, etc.)
- ✅ **Windows** 10/11 (Docker Desktop + WSL 2)

### 快速开始

#### 🚀 本地开发（推荐）
```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp dev.env.template dev.env
# 编辑 dev.env 填写数据库和邮件配置

# 3. 启动服务
npm start
```

前端: http://localhost:9000  
后端: http://localhost:3000

#### 🐳 Docker 部署

**macOS / Linux**
```bash
docker compose up -d
```

**Windows**
- 双击 `start.bat` 或
- PowerShell: `.\start.ps1`

📖 **详细文档:**
- [本地开发 vs Docker](./docs/本地开发vs%20Docker开发.md) - 两种模式对比
- [通用部署指南](./DOCKER.md) - 适用所有平台
- [Windows 专用指南](./DOCKER-WINDOWS.md) - Windows 特有配置
- [跨平台说明](./CROSS-PLATFORM.md) - 平台对比和最佳实践

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

本应用采用单体仓库（monorepo）结构，使用 npm workspaces 管理前后端两个子包。

*   **前端 (`frontend/`):** 一个 Quasar 单页应用 (SPA)。
    *   代码目录：`frontend/src/`（pages, components, stores/Pinia, router 等）
    *   开发服务器运行于 `9000` 端口。
    *   所有 API 请求 (`/api/*`) 代理到本地后端 `http://localhost:3000`。

*   **后端 (`backend/`):** 一个 Node.js/Express.js 应用。
    *   服务器运行于 `3000` 端口。
    *   通过 `/api` 前缀暴露 RESTful API。
    *   代码组织：`backend/routes/`、`backend/modules/`、`backend/database/`、`backend/appSettings/`。

*   **数据库 (`backend/database/`):**
    *   使用 PostgreSQL 作为主要的关系型数据库。
    *   表定义位于 `backend/database/postgreDB/tables/`。
    *   Redis 用于缓存或会话存储。

## 3. 核心功能

根据项目文件结构和文档分析，本应用包含以下核心功能：

*   **房间管理:**
    *   配置不同房型，包括价格、设施、图片等详细信息。
    *   支持动态定价（例如，根据季节或日期调整价格）。
    *   查看房间状态（如：可用、入住、打扫中）。

*   **订单管理:**
    *   创建、查看和管理客户预订/订单。
    *   提前退房：前端弹窗使用 `frontend/src/pages/OrderManagement/components/EarlyCheckoutDialog.vue`，核心计算在 `composables/useEarlyCheckoutLogic.js`，会基于账单按入住日期聚合剩余房费生成建议退款与可退日期，支持未入住/已入住两种路径。

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

## 4. 自动账单任务（18:00）

为了确保 “仅创建了订单但尚未入住/取消” 的房单也能在当天记账，后端引入了 `autoBillJob` 定时任务：

- 默认在每天 **18:00（Asia/Shanghai）** 通过 `node-cron` 触发。
- 过滤规则：`check_in_date <= 目标日 < check_out_date` 且订单状态位于白名单（默认 `pending,reserved`）。
- 若尚未存在相应日期的 `房费` 账单，则按照订单的总房费 / 住宿晚数生成当日账单（只写账单，不改变订单状态）。
- 幂等：同一订单+日期只会生成一次，重复运行会直接跳过。
- 监控：仅通过邮件将执行摘要发送至 `AUTO_BILL_ALERT_EMAILS` 指定的地址列表。

**环境变量（`dev.env` / `.env.test` / `docker.dev.env` 均已包含）**

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `AUTO_BILL_ENABLED` | 是否启用定时任务 | `true` |
| `AUTO_BILL_CRON` | cron 表达式 | `0 18 * * *` |
| `AUTO_BILL_TZ` | 时区 | `Asia/Shanghai` |
| `AUTO_BILL_STATUS_WHITELIST` | 需要扫描的订单状态，逗号分隔 | `pending,reserved` |
| `AUTO_BILL_ALERT_EMAILS` | 汇总邮件收件人，逗号分隔。为空时回退到 `ADMIN_EMAIL` | （空） |

若需手动触发，可在服务器中引入 `runAutoBillJobOnce`（`backend/appSettings/schedulers/autoBillJob.js`）或直接调用 `autoBillService.runAutoBillJob()` 并传递目标日期。

## 5. 如何开始

1.  **安装依赖（workspaces）:**
    ```bash
    npm install
    ```
2.  **本地开发（同时启动前后端）:**
    ```bash
    npm run dev
    ```
    - 前端：`http://localhost:9000`
    - 后端健康检查：`http://localhost:3000/api/hup`

3.  **分别启动：**
    ```bash
    # 启动后端（watch 模式）
    npm --workspace backend run dev

    # 启动前端（quasar dev）
    npm --workspace frontend run dev
    ```

4.  **数据库管理（在根目录透传到 backend）：**
    ```bash
    npm run db:init         # 初始化数据库与表（调用 backend/database/postgreDB/pg.js）
    npm run export-structure
    npm run export-all
    ```

5.  **生产运行（仅后端）：**
    ```bash
    npm start               # 等价于 npm --workspace backend run start
    ```

6.  **容器化（Docker Compose）：**
    ```bash
    docker compose up -d --build   # 启动 postgres、backend、frontend（开发示例）
    docker compose logs -f backend
    ```

## 6. 目录总览（简）

```
hotel-management-system/
├── frontend/
│   ├── src/
│   ├── quasar.config.js
│   └── package.json
├── backend/
│   ├── appSettings/
│   ├── database/
│   │   ├── postgreDB/
│   │   │   ├── tables/
│   │   │   └── pg.js
│   │   └── redis/
│   ├── modules/
│   ├── routes/
│   ├── scripts/
│   ├── tests/
│   ├── server.js
│   └── package.json
├── compose.yaml
├── dev.env
└── package.json              # workspaces 根配置
```
