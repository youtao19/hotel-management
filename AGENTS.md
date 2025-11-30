# Repository Guidelines

This workspace houses a Quasar frontend and an Express backend maintained via npm workspaces. Use this guide as your quick-start checklist when contributing features or fixes.

## Project Structure & Module Organization

- `frontend/src` holds SPA views, components, and assets; adjust `quasar.config.js` for UI build settings.
- `backend/modules` contains domain logic, while `backend/routes` maps incoming requests.
- `backend/appSettings` stores runtime configuration helpers; persistence lives in `backend/database/postgreDB` with Redis utilities alongside.
- Tests belong in `backend/tests` (unit/api/integration), and environment templates (`dev.env.template`, `docker.dev.env`) plus `compose.yaml` sit at the repository root.

## Build, Test, and Development Commands

- `npm install` installs all workspace dependencies.
- `npm start` runs backend (port 3000) and frontend (port 9000) together via `concurrently`.
- `npm run dev` starts the backend with hot reload; pair with `npm --workspace frontend run dev` for split sessions.
- `npm run build` outputs the production bundle to `frontend/dist`.
- `npm test` or `npm run test:watch` executes the Jest suite; `npm test -- --coverage` reports coverage.
- `npm run db:init` / `npm run db:migrate` bootstrap and evolve the PostgreSQL schema.

## Coding Style & Naming Conventions

- Keep two-space indentation; backend stays CommonJS with double-quoted strings.
- Vue components use PascalCase; helpers and utilities stay camelCase; reuse paths from `jsconfig.json`.
- Run the Quasar formatter or IDE defaults before committing.

## Testing Guidelines

- Jest is configured via `backend/tests/setup.js`. Place specs in `backend/tests/unit`, endpoint checks in `backend/tests/api`, and flows in `backend/tests/integration`.
- Name files with `.test.js` or `.spec.js`; share fixtures through `backend/tests/__mocks__`.
- Ensure both success and failure paths are covered; confirm coverage with `npm test -- --coverage`.

## Commit & Pull Request Guidelines

- Write imperative commit subjects (≤72 chars) and prefix with scope when useful, e.g., `backend/orders: fix deposit balance`.
- Pull requests should describe impact, include manual test notes, attach UI screenshots if applicable, and link related issues.
- Run `npm test` (and relevant DB scripts) before opening a PR; note any skipped checks in the description.

## Environment & Security Notes

- Copy `dev.env.template` to `dev.env` (and `docker.dev.env` when containerizing) before running services.
- Never commit secrets or personal data; rotate any exposed credentials immediately.

## always answer me in Chinese