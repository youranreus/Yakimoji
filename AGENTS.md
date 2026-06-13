# Repository Guidelines

## Project Structure & Module Organization

Yakimoji is a React Router Framework Mode app served through Express. Application code lives in `app/`: route modules are in `app/routes`, reusable UI in `app/shared/ui`, feature-domain code in `app/features`, and server-only helpers in `app/server`. Express bootstrap code is in `server/` and `server.js`. Database context, Drizzle schemas, and migrations are in `database/`, `drizzle/`, and `drizzle.config.ts`. Static assets go in `public/`. Tests live in `tests/`, with API coverage in `tests/api`, browser-like flows in `tests/e2e`, and helpers in `tests/helpers`. BMAD artifacts stay under `_bmad-output/`.

## Build, Test, and Development Commands

Use pnpm 10.x with Node.js 20.19+.

- `pnpm dev`: starts the dotenv-backed local Express server.
- `pnpm build`: creates the React Router production build.
- `pnpm start`: serves the production build with `NODE_ENV=production`.
- `pnpm typecheck`: regenerates React Router types and runs TypeScript build checks.
- `pnpm test`: runs Node's built-in test runner over `tests/**/*.test.*`.
- `pnpm verify:scaffold`: validates expected scaffold structure.
- `pnpm db:generate` / `pnpm db:migrate`: generate and apply Drizzle migrations.

## Coding Style & Naming Conventions

Use TypeScript ESM and match the existing two-space indentation style. Keep route filenames aligned with React Router conventions, for example `app/routes/api.tasks.$taskId.ts` and `app/routes/workspace.tsx`. Use `.server.ts` or server-only folders for code that must not ship to the browser. Prefer domain modules under `app/features/<domain>/`, shared UI under `app/shared/ui/`, and centralized environment access in `app/server/env.server.ts`.

## Testing Guidelines

Tests use Node's native test runner with `.test.ts` or `.test.mjs` suffixes. Place route/API coverage in `tests/api`, broader workflow tests in `tests/`, and browser-like coverage in `tests/e2e`. Add focused regression tests for bug fixes and run `pnpm test` plus `pnpm typecheck` before opening a PR. For database changes, also run the relevant Drizzle command against local PostgreSQL.

## Commit & Pull Request Guidelines

Git history mostly follows Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, and `chore: ...`. Keep new commit messages in that style, such as `fix: preserve task diagnostics status`. Pull requests should include a short summary, linked story or issue, verification commands, migration notes, and screenshots for visible UI changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local development and never commit secrets. `DATABASE_URL`, `SESSION_SECRET`, and SSO settings drive authentication and persistence. Local `http://localhost` intentionally differs from production HTTPS cookie behavior, so verify auth-sensitive changes in the appropriate environment.
