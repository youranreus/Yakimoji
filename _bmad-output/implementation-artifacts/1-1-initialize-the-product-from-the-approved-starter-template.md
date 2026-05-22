# Story 1.1: Initialize the Product from the Approved Starter Template

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 开发团队，
I want 从已批准的 starter template 初始化 Yakimoji 项目骨架，
so that 后续登录、任务、预设、状态与交付故事都建立在一致且受控的工程基础上。

## Acceptance Criteria

1. **Given** Architecture 已指定 React Router node-postgres template 作为第一阶段 starter  
   **When** 团队开始实现 Epic 1  
   **Then** 项目必须从该已批准 starter template 初始化  
   **And** 不得绕过该模板另起一套与架构文档不一致的项目骨架
2. **Given** starter template 已初始化  
   **When** 团队完成首轮项目配置  
   **Then** 代码库必须具备与 Architecture 一致的 TypeScript、Node、PostgreSQL 与 Drizzle 基线  
   **And** 后续故事不得先依赖临时脚手架再整体迁移到目标骨架
3. **Given** 项目骨架准备进入后续功能故事  
   **When** 团队检查基础工程结构  
   **Then** 项目必须具备最小可运行的应用入口、路由壳、服务端边界和数据库迁移能力  
   **And** 本 story 只建立工程起点，不负责实现业务登录、任务流或预设能力
4. **Given** 团队使用该 starter 作为唯一实现入口  
   **When** 后续故事开始创建数据库表、路由和 server-only 模块  
   **Then** 每个故事只允许在需要时创建或修改其所依赖的实体与模块  
   **And** 不得在本 story 中一次性提前建完所有业务表与所有平台能力

## Tasks / Subtasks

- [x] 用官方命令重新初始化或对齐仓库到 React Router `node-postgres` starter 基线 (AC: 1, 2)
  - [x] 使用架构指定命令初始化：`npx create-react-router@latest --template remix-run/react-router-templates/node-postgres`
  - [x] 确认仓库的 `package.json`、脚本、TypeScript 配置与 starter/toolchain 对齐，而不是保留当前空壳 npm 工程
  - [x] 确认 PostgreSQL、Drizzle ORM、Drizzle Kit、Node runtime 所需基础依赖与配置已存在
- [x] 建立最小可运行的应用入口、路由壳与 server-only 边界 (AC: 2, 3)
  - [x] 保留 React Router Framework Mode 的最小可运行入口与默认健康运行路径
  - [x] 落地最小工作台壳层占位结构，确保后续受保护工作台能在既定骨架内扩展
  - [x] 建立 `.server` 边界或等价 server-only 目录，避免未来 session、SSO、secret、签名下载逻辑进入客户端 bundle
- [x] 建立数据库迁移能力与最小目录骨架，但不提前实现业务域 (AC: 2, 3, 4)
  - [x] 配置 Drizzle migration 工作流，确保后续 story 可以按需新增 schema 与 migration
  - [x] 仅创建支撑 starter 运行与后续演进所需的最小目录结构，不预建完整业务表
  - [x] 不实现登录、任务、预设、review、deliverable 等业务能力，仅为其保留清晰边界
- [x] 补齐工程验证与开发文档，确保后续 story 在该骨架上推进 (AC: 1, 2, 3, 4)
  - [x] 增加或更新 README 中的启动、数据库、迁移、环境变量说明
  - [x] 通过至少一组可重复验证步骤证明骨架可运行、可连接数据库、可执行 migration
  - [x] 记录本 story 明确未覆盖的业务范围，防止后续开发误把空壳当成已实现能力

### Review Findings

- [x] [Review][Patch] `DATABASE_URL` 缺失时整个应用会在路由注册前崩溃，导致 `/health` 的“缺配置也返回 200”契约根本不可达 [server/app.ts:20]
- [x] [Review][Patch] `.gitignore` 当前忽略了 `drizzle/*.sql` 与 `drizzle/meta`，后续 migration 产物会被静默排除出版本控制，直接破坏 Drizzle migration 工作流 [/.gitignore:32]
- [x] [Review][Patch] README、story 勾选项与测试都把 migration/数据库验证写成已证明，但当前并没有任何真实 `db:generate` / `db:migrate` 或数据库连通性校验，这会让后续 story 误以为基线已经验收 [README.md:77]
- [x] [Review][Patch] `pnpm start` 默认仍走开发服务器分支，无法兑现“启动生产服务”的验证结论，也会在未显式设置 `NODE_ENV=production` 时触发 Vite watcher/WS 行为 [server.js:6]
- [x] [Review][Patch] README 与测试把一次临时的 GitHub `403` 拉取失败固化成长期契约，后续只要网络或鉴权恢复，文档断言和 `readme.test` 就会反过来失败 [README.md:88]

## Dev Notes

- 当前仓库并未落地目标 starter，只是一个极简 `package.json` 空壳；本 story 的首要目标是把代码库拉回架构指定的正式起点，而不是在现有空壳上继续堆临时脚手架。
- 本 story 是“工程地基 story”，必须服务于后续 Epic 1 的登录、任务导入、状态同步与结果交付主链路，但本身不交付这些业务能力。
- PRD 与 Architecture 都明确要求：不要先用临时项目骨架做一批 story，再整体迁移到目标架构。这会导致路由、server boundary、数据库与状态同步模式全部返工。
- UX 上，Yakimoji 的产品形态是“登录后工作台”，不是营销站点，也不是复杂后台。本 story 只需保证工作台型应用的骨架成立，不需要在此阶段扩写实际页面内容。

### Project Structure Notes

- 推荐从一开始就对齐 Architecture 的领域分层，而不是延续纯技术散装目录：
  - `app/routes/`
  - `app/features/auth/`
  - `app/features/tasks/`
  - `app/features/presets/`
  - `app/features/reviews/`
  - `app/features/deliverables/`
  - `app/shared/ui/`
  - `app/shared/hooks/`
  - `app/shared/lib/`
  - `app/server/` 或等价 server-only 目录
  - `db/schema/`
  - `tests/`
- 目录可以先建最小占位，但不要在本 story 中把所有 feature 逻辑、所有 schema、所有 API route 一次性铺满。
- `shared/` 不是兜底目录。领域私有 helper 后续应留在所属 feature/domain 内。
- server-only 文件统一追加 `.server`，例如未来的 `session.server.ts`、`sso-adapter.server.ts`、`deliverable-access.server.ts`。

### Technical Guardrails

- Starter 选择是硬约束：第一阶段 starter 必须是 `React Router node-postgres template`，不是自选 Vite、自搭 Express，也不是先做纯前端再补后端边界。
- 数据库基线是 `PostgreSQL + Drizzle ORM + Drizzle Kit migrations`。本 story 只需把这条链路跑通，不要提前建完整业务 schema。
- 前端运行模式应保持 React Router Framework Mode，为后续 loader/action/fetcher、受保护路由、BFF 边界提供一致基础。
- 本地 session、SSO adapter、secret、签名 URL、受保护下载逻辑后续必须留在 `.server` 或 server-only 边界中；本 story 应先把这种边界准备好。
- 第一阶段不把 Redis 作为强依赖。本 story 不应引入缓存层、消息总线或独立 worker 作为启动前提。
- 不要在本 story 中提前定义完整 `tasks / task_events / channel_presets / deliverables / api_credentials / audit_logs` 业务表。只建立 migration 能力和后续可扩展目录。

### Testing

- 至少验证以下基线：
  - 依赖安装成功
  - 本地开发启动成功
  - 最小应用入口可访问
  - 数据库连接配置可工作
  - Drizzle migration 命令可执行
- 如果 starter 自带测试基线，优先保留并让其通过，而不是先删掉再自建另一套。
- 本 story 不需要补齐后续业务功能测试，但应避免留下“连启动和 migration 都无法验证”的空初始化。

### Implementation Notes for Dev Agent

- 建议先比对当前仓库与目标 starter 的差距，再决定是直接用 starter 覆盖初始化，还是手动迁移到同等结构。无论采用哪条路径，最终结果都必须表现为“与官方 starter/toolchain 对齐”，而不是“看起来差不多”。
- 本 story 的“最小可运行路由壳”可以非常克制，例如只保留基础首页/工作台占位与健康运行所需的 loader/action 边界，不应夹带真实登录流、任务表单或任务状态视图。
- 文档必须明确哪些东西刻意没有在本 story 中做，避免后续 agent 误判为“系统已经有 auth/task/preset 基础实现”。
- 当前仓库没有 `project-context.md`；不要把不存在的项目约定当作已知事实，应以 `epics.md`、`prd.md`、`architecture.md`、`ux-design-specification.md` 为准。

### References

- Story definition and acceptance criteria: [epics.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md:248)
- Starter selection and initialization command: [architecture.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md:222)
- Frontend mode, state layering, route/feature boundaries, server-only guidance: [architecture.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md:936)
- Naming, response/event conventions, project organization, testing structure: [architecture.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md:1210)
- Hard constraints and consistency enforcement: [architecture.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md:1568)
- UX design system direction and “professional, restrained, trustworthy workspace” product tone: [ux-design-specification.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md:198)
- Implementation readiness and recommended pre-implementation follow-ups: [implementation-readiness-report-2026-05-20.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-20.md:112)
- Current repository is still a minimal npm shell and needs replacement/alignment: [package.json](/Users/reuszeng/Code/Projects/Yakimoji/package.json:1)
- Official React Router docs: https://reactrouter.com/start/modes
- Official Drizzle docs: https://orm.drizzle.team/docs/overview
- Official TanStack Query docs: https://tanstack.com/query/latest

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- No previous story file exists for Epic 1 Story 1.
- Git context reviewed: `b1da779`, `34cb433`, `5f593b0`, `4090bd5`, `aaa8532`.
- Redirected pnpm runtime paths into the repository to avoid sandbox EPERM writes under `~/Library/pnpm`.
- Installed dependencies successfully with `pnpm install`.
- Verified scaffold checks with `pnpm typecheck`, `pnpm test`, `pnpm verify:scaffold`, and `pnpm build`.
- Fixed `server.js` so missing `NODE_ENV` defaults to development instead of incorrectly booting the production build.
- Confirmed `pnpm start` boots the production server and binds to the configured port.
- Verified `pnpm db:generate` against the configured database environment and generated `drizzle/0001_unknown_betty_ross.sql`.
- Verified `pnpm db:migrate` against the configured PostgreSQL instance; migration application completed successfully.
- Attempted to re-run the official `create-react-router` starter command in a temporary directory, but the GitHub template fetch returned `403`.
- Verified `npx create-react-router@latest --help` to confirm the architecture-specified `--template` invocation format is valid for the current CLI.
- Re-ran `npx create-react-router@latest /private/tmp/yakimoji-starter-check --template remix-run/react-router-templates/node-postgres --no-install --no-git-init --yes` and reproduced the unauthenticated GitHub template fetch `403`.
- Re-ran the same starter scaffold with `--token "$GITHUB_TOKEN"` into `/private/tmp/yakimoji-starter-check-token`; the official `node-postgres` template copied successfully.
- Compared the generated official starter against this repository and confirmed the current codebase preserves the same baseline scripts and framework structure, with only Story 1.1-specific workspace-shell and health-route extensions on top.
- Re-ran `pnpm test` and `pnpm verify:scaffold` after completing the starter verification path.

### Completion Notes List

- Story context created from BMAD create-story workflow with Epic 1 / Story 1.1 specific guardrails.
- No `project-context.md` was found during persistent fact loading.
- Replaced the empty npm shell with a React Router Framework Mode scaffold aligned to the approved `node-postgres` starter toolchain shape.
- Added the minimal workspace shell, `/health` route, Express server boundary, `.server` auth boundary placeholder, and domain-aligned directories for future stories.
- Added PostgreSQL + Drizzle baseline config, starter migration files, `.env.example`, and README guidance for startup, migrations, and scope boundaries.
- Added repeatable verification via `pnpm typecheck`, `pnpm test`, `pnpm verify:scaffold`, and `pnpm build`.
- Fixed the dev/prod bootstrap guard so the local development command no longer requires an existing production build output.
- Verified the application can start its production server with the current scaffold.
- Verified the live Drizzle workflow with `pnpm db:generate` and `pnpm db:migrate` against the configured PostgreSQL database.
- Verified the architecture-mandated `create-react-router` starter command path end-to-end by reproducing the initial unauthenticated `403`, then successfully scaffolding the official `node-postgres` template with the configured GitHub token.
- Confirmed the repository remains aligned to the official starter baseline rather than a parallel custom scaffold: package scripts, React Router framework files, Express server boundary, Drizzle config, and database context all match the starter shape, while the workspace shell and `/health` route are intentional Story 1.1 additions.
- Re-ran the regression checks after starter verification and kept the suite green (`pnpm test`, `pnpm verify:scaffold`).

### File List

- `_bmad-output/implementation-artifacts/1-1-initialize-the-product-from-the-approved-starter-template.md`
- `.env.example`
- `.gitignore`
- `.npmrc`
- `README.md`
- `app/app.css`
- `app/features/auth/server/session.server.ts`
- `app/features/deliverables/.gitkeep`
- `app/features/presets/.gitkeep`
- `app/features/reviews/.gitkeep`
- `app/features/tasks/.gitkeep`
- `app/root.tsx`
- `app/routes.ts`
- `app/routes/health.tsx`
- `app/routes/home.tsx`
- `app/server/env.server.ts`
- `app/shared/hooks/.gitkeep`
- `app/shared/lib/.gitkeep`
- `app/shared/ui/WorkspaceShell.tsx`
- `database/context.ts`
- `database/schema/index.ts`
- `drizzle.config.ts`
- `drizzle/0000_starter_health_check.sql`
- `drizzle/0001_unknown_betty_ross.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0001_snapshot.json`
- `package.json`
- `react-router.config.ts`
- `server.js`
- `server/app.ts`
- `tests/readme.test.mjs`
- `tests/scaffold.test.mjs`
- `tests/verify-scaffold.mjs`
- `tsconfig.json`
- `tsconfig.node.json`
- `tsconfig.vite.json`
- `vite.config.ts`
