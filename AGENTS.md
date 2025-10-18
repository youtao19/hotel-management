# Repository Guidelines

## Project Structure & Module Organization
The root uses npm workspaces for `frontend/` (Quasar SPA) and `backend/` (Express API). Frontend code lives in `frontend/src` with project settings in `quasar.config.js`. Backend logic sits in `backend/modules`, routing in `backend/routes`, and runtime config in `backend/appSettings`. Persistence code lands in `backend/database/postgreDB` with Redis helpers nearby, and all automated tests reside under `backend/tests`. Environment templates (`dev.env.template`, `docker.dev.env`) and container config (`compose.yaml`) stay at the top level.

## Build, Test, and Development Commands
- `npm install` — install workspace dependencies.
- `npm start` — run backend (3000) and frontend (9000) together via concurrently.
- `npm run dev` — backend hot reload; combine with `npm --workspace frontend run dev` to split work.
- `npm run build` — compile frontend production bundle in `frontend/dist`.
- `npm test` / `npm run test:watch` — execute the Jest suite once or in watch mode.
- `npm run db:init` / `npm run db:migrate` — bootstrap PostgreSQL schema; ensure `dev.env` is populated.
- `docker compose up -d --build` — launch app + services in containers for parity checks.

## Coding Style & Naming Conventions
Use two-space indentation and keep backend modules on CommonJS (`require`/`module.exports`) with double-quoted strings. Vue single-file components stay PascalCase, helpers stay camelCase, and reuse the aliases defined in `jsconfig.json`. `.env` keys remain UPPER_SNAKE_CASE. With no formal linter, rely on IDE or Quasar formatting before committing.

## Testing Guidelines
`jest.config.js` wires tests to `backend/tests/setup.js`. Put unit specs in `backend/tests/unit`, endpoint checks in `backend/tests/api`, and multi-step scenarios in `backend/tests/integration`, using the existing `.test.js` or `.spec.js` suffixes. Share fixtures through `backend/tests/__mocks__`. Cover success and failure paths for new APIs, and run `npm test -- --coverage` before submitting substantial changes.

## Commit & Pull Request Guidelines
Write commits with an imperative summary (≤72 chars); English or Chinese is fine. Name the touched area when helpful (e.g. `backend/orders: fix deposit balance`) and keep each commit focused. Pull requests should explain impact, list manual test notes, attach UI screenshots when relevant, and link issues or follow-up tasks. Run `npm test` and mention any paired database script.

## Environment & Security Notes
Copy `dev.env.template` to `dev.env` (and `docker.dev.env` when containerizing) before starting services; never commit filled secrets. Scrub personal data from SQL exports or cookies before sharing and rotate credentials immediately if they leak.
