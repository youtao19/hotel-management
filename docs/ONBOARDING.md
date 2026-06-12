# 🏨 Hotel Management System — Onboarding Guide

Welcome to the Hotel Management System (酒店管理系统)! This guide will help you understand the project's architecture, navigate the codebase, and get up to speed quickly.

---

## Project Overview

**hotel-management-system** is a full-stack web application for managing hotels and guesthouses. It handles room management, room status tracking, order lifecycle (creation → check-in → check-out → cancellation), billing with multi-payment splits, income statistics, shift handover, OTA channel integrations, and Douyin (TikTok) direct-booking connectivity.

| Aspect | Details |
|---|---|
| **Frontend** | Vue 3, Quasar Framework, Pinia, Vue Router, Chart.js, Axios |
| **Backend** | Express.js, PostgreSQL, Redis |
| **Build** | Vite (frontend), npm workspaces (monorepo) |
| **Testing** | Jest (backend unit/integration), Playwright (E2E) |
| **CI/CD** | GitHub Actions |
| **Deployment** | Docker, Docker Compose |

### Monorepo Structure

```
hotel-management/
├── frontend/          # Vue 3 + Quasar SPA
├── backend/           # Express API server
├── e2e/               # Playwright E2E tests
├── sql/               # Database schema & migrations
├── docs/              # API docs & integration guides
└── .github/workflows/ # CI pipelines
```

---

## Architecture Layers

The codebase is organized into **19 architectural layers** across frontend, backend, and cross-cutting concerns:

### Backend Layers

| Layer | Files | Description |
|---|---|---|
| **Backend Entry Point** | 7 | Express app bootstrap (`app.js`, `server.js`), middleware setup (session, CORS, rate limiting), route mounting |
| **Backend Business Modules** | 106 | Core domain logic organized by feature: orders, rooms, billing, income, handover, dashboard, Douyin, OTA, reviews |
| **Backend Database Layer** | 21 | PostgreSQL connection pool (`pg.js`), query helpers, data access utilities |
| **Backend API Routes** | 11 | Express route definitions mapping HTTP endpoints to controllers |
| **Backend Tests** | 28 | Jest unit and integration tests for backend modules |
| **Backend Scripts & Settings** | 14 | Scheduled jobs (auto-billing), app configuration, Douyin SDK setup |

### Frontend Layers

| Layer | Files | Description |
|---|---|---|
| **Frontend Pages** | 92 | Vue page components across 14 sections: orders, rooms, income, handover, dashboard, etc. |
| **Frontend Components** | 3 | Shared reusable UI components (CheckIn, CheckInConfirmDialog, HomeView layout) |
| **Frontend State Management** | 7 | Pinia stores for orders, rooms, bills, auth, and UI state |
| **Frontend Router** | 2 | Vue Router configuration and route definitions |
| **Frontend API Layer** | 1 | Axios-based HTTP client (`frontend/src/api/index.js`) |
| **Frontend Utilities** | 4 | Shared utility functions and Quasar boot plugins |
| **Frontend Configuration** | 9 | Quasar config, Vite build, environment files |

### Cross-Cutting Layers

| Layer | Files | Description |
|---|---|---|
| **E2E Tests** | 21 | Playwright test suites for critical user flows |
| **Data & Schema** | 20 | SQL schema files, migrations, and data utilities |
| **Infrastructure** | 6 | Dockerfiles, docker-compose, GitHub Actions workflows |
| **Documentation** | 34 | API specifications, integration guides, operation manuals |
| **Project Configuration** | 21 | Root package.json, environment templates, editor configs |

---

## Key Concepts & Patterns

### 1. Module Layered Architecture

Every backend business module follows a consistent **4-layer pattern**:

```
routes → controller → service → repository
```

- **Routes** (`*.routes.js`): Define HTTP endpoints and map to controllers
- **Controllers** (`*.controller.js`): Handle request validation and response formatting
- **Services** (`*.service.js`): Implement business logic and orchestration
- **Repositories** (`*.repository.js`): Encapsulate all database queries

**Example:** `backend/modules/order-create/`
```
orderCreate.routes.js      → defines POST /api/orders
orderCreate.controller.js  → validates input, calls service
orderCreate.service.js     → pricing breakdowns, payment splits, transactions
orderCreate.repository.js  → SQL inserts/updates for orders and bills
```

### 2. Centralized Database Access

**`backend/database/postgreDB/pg.js`** is the most-imported file in the project (66 imports). It provides a connection pool and query helpers that all modules depend on for persistence.

### 3. Order State Machine

Orders follow a defined lifecycle:
- **待入住** (Pending) → **已入住** (Checked In) → **已退房** (Checked Out)
- With branches for: 快速入住 (Fast Check-in), 提前退房 (Early Check-out), 续住 (Extend Stay), 换房 (Room Change), 取消 (Cancel)

### 4. Multi-Payment Split

Orders support splitting payments across multiple methods (cash, WeChat, WeChat Pay, etc.) for both room charges and deposits. The `orderCreate.service.js` normalizes these splits during order creation.

### 5. Shift Handover (交接班)

The handover module aggregates daily financial totals by payment method, supporting shift-by-shift reconciliation with memo notes.

### 6. Channel Integration Pattern

OTA channels (Douyin, Fliggy) follow a plugin-based integration pattern:
- **Douyin module**: Room type matching, presale packages, price/availability notifications, webhook handlers
- **OTA routes**: Generic channel API with HMAC-SHA256 signature verification

### 7. Frontend Composables

Vue pages use composition API composables (in `composables/` subdirectories per page) to encapsulate business logic and state, keeping page components focused on layout and presentation.

---

## Guided Tour

Follow these steps to build a mental model of the codebase:

### Step 1 — Project Overview
Read `README.md` for the project's purpose, feature list, and architecture overview.

### Step 2 — Backend Entry Point
Start with `backend/server.js` → `backend/app.js`. Trace how the Express app initializes middleware, connects to PostgreSQL, and mounts route modules.

### Step 3 — Database Layer
Examine `backend/database/postgreDB/pg.js` — the connection pool and query helper that every module depends on.

### Step 4 — Core Business Modules
Explore a complete module like `backend/modules/order-create/` or `backend/modules/room-status/` to understand the routes → controller → service → repository pattern.

### Step 5 — API Route Definitions
Browse `backend/routes/` to see how HTTP endpoints are organized and connected to feature modules.

### Step 6 — Frontend Pages
Visit `frontend/src/pages/` — especially `RoomStatus/`, `OrderManagement/`, and `Revenue/` — to see how the UI mirrors the backend's domain structure.

### Step 7 — Frontend State Management
Review the Pinia stores in `frontend/src/stores/` to understand how the frontend manages and synchronizes application state.

### Step 8 — End-to-End Testing
Check `e2e/` for Playwright test suites that demonstrate critical user flows like login, check-in, and order management.

### Step 9 — Infrastructure & Deployment
Review `compose.yaml`, Dockerfiles, and `.github/workflows/` for the deployment and CI/CD setup.

---

## File Map

### Backend Entry Point
| File | Purpose |
|---|---|
| `backend/server.js` | HTTP server startup |
| `backend/app.js` | Express app bootstrap: middleware, DB, routes |
| `backend/appSettings/setup.js` | App configuration and initialization |

### Backend Database
| File | Purpose |
|---|---|
| `backend/database/postgreDB/pg.js` | PostgreSQL connection pool and query helper |
| `backend/database/redis/redis.js` | Redis client for caching/sessions |

### Backend Core Modules
| Module Directory | Purpose |
|---|---|
| `backend/modules/order-create/` | Order creation, fast check-in, pricing, payment splits |
| `backend/modules/order-manage/` | Order lifecycle: check-in, check-out, extend, cancel, room change |
| `backend/modules/room-status/` | Room status management (single-day & 14-day calendar) |
| `backend/modules/room-manage/` | Room and room type CRUD operations |
| `backend/modules/bill/` | Billing: daily charges, adjustments, deposit refunds |
| `backend/modules/income-statistics/` | Revenue dashboards and detailed billing reports |
| `backend/modules/dashboard/` | Main dashboard data aggregation |
| `backend/modules/review/` | Guest review invitation and rating management |
| `backend/modules/douyin/` | Douyin OTA integration (29 files: token, packages, rate plans, webhooks) |
| `backend/modules/shift-handover/` | Shift handover API, validation, transaction save, and module docs |
| `backend/modules/handoverModule.js` | Shift handover processing |

### Backend Routes
| File | Purpose |
|---|---|
| `backend/routes/ota/` | OTA channel route stubs (Fliggy, etc.) |
| `backend/routes/plugin/` | Plugin-based external integrations |

### Frontend Key Files
| File | Purpose |
|---|---|
| `frontend/src/api/index.js` | Axios HTTP client with auth interceptors |
| `frontend/src/router/routes.js` | Vue Router route definitions |
| `frontend/src/stores/orderStore.js` | Order state management |
| `frontend/src/stores/roomStore.js` | Room state management |
| `frontend/src/stores/billStore.js` | Billing state management |
| `frontend/src/layouts/HomeView.vue` | Main app layout shell |
| `frontend/src/pages/Dash-board.vue` | Dashboard page |

### Frontend Page Sections
| Section | Files | Description |
|---|---|---|
| OrderManagement | 23 | Order list, detail, create, check-in/out flows |
| Handover | 16 | Shift handover process, history, memos |
| CreateOrder | 12 | Order creation wizard |
| Revenue | 10 | Income statistics, charts, detailed bills |
| RoomManagement | 9 | Room and room type CRUD |
| ReviewManagement | 8 | Review invitation and tracking |
| RoomStatus | 7 | Room status calendar (single-day & 14-day) |

### Infrastructure
| File | Purpose |
|---|---|
| `compose.yaml` | Docker Compose for full stack deployment |
| `frontend/Dockerfile` | Frontend production Docker build |
| `backend/dockerfile` | Backend production Docker build |
| `.github/workflows/test.yml` | Backend test CI pipeline |
| `.github/workflows/playwright.yml` | E2E test CI pipeline |

---

## Complexity Hotspots ⚠️

These files have high complexity and should be approached carefully:

### Critical Business Logic
| File | Why It's Complex |
|---|---|
| `backend/modules/order-create/orderCreate.service.js` | Core order creation with pricing breakdowns, payment splits, and transaction management |
| `backend/modules/order-manage/orderManage.service.js` | Order lifecycle logic: check-in, check-out, extend stay, cancel, room change |
| `backend/modules/order-manage/orderManage.repository.js` | Complex SQL queries for order operations with status transitions |
| `backend/modules/handoverModule.js` | Shift handover with multi-payment aggregation and reconciliation |
| `backend/modules/income-statistics/incomeStatistics.repository.js` | Complex revenue queries with date filtering and aggregation |

### Integration Complexity
| File | Why It's Complex |
|---|---|
| `backend/modules/douyin/rate-plan/ratePlan.routes.js` | Douyin rate plan API with complex request/response mapping |
| `backend/routes/plugin/plugin-order.service.js` | Plugin-based order processing with external channel requirements |

### Frontend Complexity
| File | Why It's Complex |
|---|---|
| `frontend/src/api/index.js` | Axios client with auth interceptors, token refresh, error handling |
| `frontend/src/stores/orderStore.js` | Complex order state with many actions and async flows |
| `frontend/src/pages/Dash-board.vue` | Dashboard with multiple data sources and Chart.js visualizations |
| `frontend/src/pages/Handover/components/HandoverProcess.vue` | Multi-step handover process with financial calculations |
| `frontend/src/components/CheckIn.vue` | Check-in flow with payment split UI |

### Heavy Test Files
| File | Why It's Complex |
|---|---|
| `backend/tests/checkIn.test.js` | Extensive check-in scenarios with payment splits and edge cases |
| `backend/tests/integration/handover.test.js` | Complex handover test fixtures with financial calculations |
| `backend/tests/bill.test.js` | Billing scenarios across multiple operations |
| `e2e/tool.js` | Shared E2E test utilities and helpers |

---

## Getting Started Checklist

- [ ] Read `README.md` for project overview
- [ ] Set up local dev environment: `cp dev.env.template dev.env` and configure PostgreSQL
- [ ] Install dependencies: `npm install` (from project root)
- [ ] Start backend: `npm run dev:backend`
- [ ] Start frontend: `npm run dev:frontend`
- [ ] Or start both: `npm start`
- [ ] Read `backend/app.js` to understand middleware and route mounting
- [ ] Explore one complete module (e.g., `backend/modules/order-create/`)
- [ ] Review `frontend/src/router/routes.js` for page structure
- [ ] Run tests: `npm test` (backend) or `npm run test:e2e` (E2E)

---

## Quick Reference

| What | Command |
|---|---|
| Install dependencies | `npm install` |
| Start dev (both) | `npm start` |
| Backend only | `npm run dev:backend` |
| Frontend only | `npm run dev:frontend` |
| Build frontend | `npm run build` |
| Run backend tests | `npm test` |
| Run E2E tests | `npm run test:e2e` |
| Watch backend tests | `npm run test:watch` |
| Database init | `npm run db:init` |
| Database migrate | `npm run db:migrate` |
| Database backup | `npm run db:backup` |
| Export DB schema | `npm run export-schema` |

---

*This guide was auto-generated from the project's knowledge graph on 2026-06-01. Last analyzed commit: `e5219a4`.*
