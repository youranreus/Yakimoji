# Story 4.1: API Credential Validation and Task Create Request

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 外部集成方,
I want 使用独立 API 凭证成功发出任务创建请求,
so that 我能把 Yakimoji 接入到自己的生产流程里而不依赖人工登录态。

## Acceptance Criteria

1. **Given** Yakimoji 已为外部集成方分配有效的 API 凭证  
   **When** 外部系统使用该凭证调用任务创建接口  
   **Then** 系统必须允许其创建视频处理任务  
   **And** 该认证流程必须独立于 Web 登录态与浏览器 session
2. **Given** 外部系统调用任务创建接口  
   **When** 请求通过认证和基础校验  
   **Then** 系统必须创建可进入后续处理链路的正式任务记录  
   **And** 该任务必须与对应的 API 调用主体建立可追踪关联
3. **Given** 外部系统完成一次成功的创建请求  
   **When** 系统返回成功响应  
   **Then** 响应必须足以让集成方继续查询该任务  
   **And** 本 story 不负责定义完整结果回传机制、回调策略或状态轮询策略
4. **Given** 外部系统提交有效的视频来源信息与必要元数据  
   **When** 系统接受创建请求  
   **Then** 系统必须返回统一的成功响应结构  
   **And** 响应中至少包含任务标识与后续可查询该任务的基础信息
5. **Given** 外部系统缺失凭证、使用无效凭证或使用已过期凭证  
   **When** 请求进入 API 认证边界  
   **Then** 系统必须返回 401 或 403  
   **And** 不得返回任何受保护业务数据
6. **Given** 外部系统尝试使用 Web 会话、浏览器 cookie 或其他非 API 凭证方式调用外部接口  
   **When** 请求进入外部 API  
   **Then** 系统必须拒绝该请求  
   **And** 不得混用 Web 认证模型与 API 认证模型
7. **Given** 外部系统成功创建任务  
   **When** 系统记录该任务来源  
   **Then** 任务必须明确标记其来源于外部 API 而不是人工工作台创建  
   **And** 该标记应可用于后续审计、支持排障与状态查询
8. **Given** 外部系统提交的创建请求缺少必要字段或格式无效  
   **When** 系统执行请求校验  
   **Then** 系统必须返回统一的错误响应结构  
   **And** 错误内容必须足以让集成方修正请求后重试
9. **Given** 系统处理 API 创建请求  
   **When** 请求成功或失败  
   **Then** 系统必须记录可追踪的 request_id 和 API 调用主体上下文  
   **And** 这些记录必须能支撑后续合约排障与访问审计

## Tasks / Subtasks

- [x] 建立 `api_credentials` 认证与追踪基础设施 (AC: 1, 2, 5, 6, 7, 9)
  - [x] 在 `database/schema/` 中新增 `api_credentials` schema，并通过 Drizzle migration 落地最小字段：公开标识、密钥哈希/摘要、状态、过期时间、主体元数据、最近使用时间、创建/更新时间
  - [x] 为任务创建链路补齐 `api_credential_id` / `createdBy` 级别的追踪信息，确保 API 创建任务与工作台创建任务可区分
  - [x] 新增 server-only API credential 解析与校验模块，统一处理缺失、格式错误、未知、过期、停用凭证
- [x] 暴露 `POST /tasks` 外部 API 创建入口，并复用现有任务创建领域逻辑 (AC: 1, 2, 3, 4, 7)
  - [x] 在 `app/routes/` 中新增外部 API route，不复用 `workspace` action 作为对外入口
  - [x] 以 code-first 方式定义请求校验、成功 envelope、错误 envelope，并保持 API JSON 字段使用 `camelCase`
  - [x] 封装 API task create service，尽量复用现有任务创建领域逻辑与状态初始化能力，避免复制第二套任务创建落库/事件记录逻辑
- [x] 落实 API 认证隔离与统一错误 contract (AC: 1, 5, 6, 8, 9)
  - [x] 缺失/无效凭证返回 `401`，过期/停用凭证返回 `403`，并使用 readiness 文档固定的错误码
  - [x] 明确浏览器 cookie / Web session 不参与外部 API 鉴权；当 cookie 与 credential 同时存在时，仅以 credential 主体为准
  - [x] 422 请求校验错误使用统一错误 envelope，并提供字段级 `details`
- [x] 补齐 OpenAPI 契约、审计与自动化测试 (AC: 3, 4, 5, 6, 8, 9)
  - [x] 新增或更新 `docs/api/public-openapi.yaml`，写入 `POST /tasks` 的请求/响应/错误 contract
  - [x] 为成功创建、缺失凭证、无效凭证、过期凭证、cookie 冒充、字段校验失败等场景新增 route/service contract tests
  - [x] 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`、`pnpm db:migrate`

## Dev Notes

### Story Intent

- 本 story 只交付 Epic 4 的外部 API 创建入口与认证边界，不提前实现 `GET /tasks/:taskId`、`GET /tasks/:taskId/result`。
- 核心目标是把已稳定的内部任务创建/状态语义，安全地暴露到独立 `api_credentials` 边界之下。
- create-story 阶段必须以以下 readiness 产物为真源，不允许在实现时重新发明 contract：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-checklist-2026-06-08.md`

### Readiness-Derived Contract Guardrails

- `epic-4-readiness-review-2026-06-08.md` 已批准 Epic 4 开工，明确顺序为 `4.1 -> 4.2 -> 4.3`，且指出 4.1 应先落地 API credential + task create request。
- `epic-4-api-contract-mapping.md` 对 4.1 已收口三件事：
  - 成功响应使用 `{ data, meta }`
  - `POST /tasks` 成功至少返回 `taskId`、`status`、`sourceType`、`createdBy`、`links`、`meta.requestId`
  - 缺失/无效/过期 credential 与校验失败必须走统一错误 envelope，而不是 UI 风格的 `{ ok: false }`
- `epic-4-api-auth-test-strategy.md` 虽不是本次用户点名必读文件，但它是 readiness review 的第三个 gate 真源。4.1 的认证/授权测试必须遵守：
  - missing credential -> `401 API_CREDENTIAL_MISSING`
  - malformed / unknown credential -> `401 API_CREDENTIAL_INVALID`
  - expired credential -> `403 API_CREDENTIAL_EXPIRED`
  - revoked credential -> `403 API_CREDENTIAL_REVOKED`
  - browser session only -> `401 API_CREDENTIAL_MISSING`

### Dependencies

- 依赖 Epic 3 已建立的内部 contract，而不是重新定义任务状态：
  - `task status semantics`
  - `auth boundary`
  - `failure / request_id` 可追踪约束
- 依赖现有任务创建链路与事件账本：
  - `app/features/tasks/server/task-intake.server.ts`
  - `app/features/tasks/server/task-events.server.ts`
  - `app/features/tasks/server/task-status.server.ts`
- 依赖现有 request context / audit 基础设施：
  - `app/features/auth/server/request-context.server.ts`
  - `app/features/auth/server/audit.server.ts`
  - `database/schema/auth.ts`

### Current Codebase State

- 当前仓库只有工作台内的任务创建入口：
  - `app/routes/workspace.tsx` 的 `action` 在 creator session + RBAC 通过后，委托给 `handleTaskIntakeAction`
  - 这意味着目前没有任何正式对外 `POST /tasks` API route
- 当前任务创建是“工作台主体驱动”而非“API credential 主体驱动”：
  - `database/schema/tasks.ts` 只有 `creator_user_id`，没有 `api_credential_id`
  - `confirmTaskCreation` 会把 `requestId` 写入 `sourceSnapshot` 和 `task_events`，但不会记录外部 API credential 主体
- 当前错误响应分成两种风格：
  - 内部工作台 action 常返回 `{ ok: false, code, message, request_id }`
  - 架构与 Epic 4 mapping 要求外部 API 统一改为 `{ request_id, error: { code, message, details } }`
- 当前路由清单只有 `workspace`、`workspace/tasks/:taskId`、`workspace/deliverables/:deliverableId`、`workspace/task-sync`、`health` 等，没有 `api.*` 路由
- `docs/api/public-openapi.yaml` 当前不存在，但 ADR 002 已要求 public API contract 必须 checked-in 且进入 CI 校验

### Implementation Guardrails

- 不允许直接把 `workspace.tsx` 的 creator-only action 暴露给第三方；外部 API 必须有独立 route、独立认证入口、独立错误 contract。
- 不允许复制第二套任务创建落库逻辑。优先抽取可复用的 server service，把“外部 API 入参 -> 内部任务创建命令”的适配层放在 API route / service 边界。
- 不允许把 Web session、SSO role 或浏览器 cookie 作为 API 鉴权事实。外部 API 只认 `api_credentials`。
- 不允许在外部 API 响应中暴露 support-only / workspace-only 语义，例如：
  - 原始事件 payload
  - support diagnostics
  - 内部存储键
  - 工作台壳层概念
- 不允许在本 story 提前扩 scope 到 4.2/4.3 的完整结果语义、失败语义、non-match 业务分支；本 story 只需要返回“足以继续查询任务”的最小信息。

### Architecture Compliance

- 路由与资源边界必须遵循架构文档：
  - 外部 API 采用 REST
  - 对外资源使用复数名与 `kebab-case` 路径
  - 状态枚举继续复用统一 `snake_case` 顶层状态
- 安全边界必须遵循：
  - `api_credentials` 与 Web session 分离
  - 所有失败路径带 `request_id`
  - 交付物保护模型不在 4.1 内扩展，但 API 设计不能破坏后续受控下载 contract
- 观测性必须遵循：
  - 结构化日志至少能串起 `request_id`、`task_id`、`api_credential_id`
  - API 成功/失败都要能支撑后续审计与问题定位

### Library / Framework Requirements

- 继续沿用当前仓库基线：
  - React Router `7.14.0`
  - Drizzle ORM `0.36.x` + Drizzle Kit migration
  - TypeScript `5.9.x`
  - Node test runner + `tsx`
- 请求校验优先复用仓库现有模式；若需要 schema validation，可使用已存在依赖 `zod`，不要引入新的 API validation 框架。
- public API contract 文档采用 OpenAPI；架构文档当前基线指向 OpenAPI `3.2.0`，实现时不要自创 YAML 结构。

### File Structure Requirements

- 优先新增而不是污染现有 creator workspace 文件：
  - `app/routes/api.tasks.ts` 或等价 public API route
  - `app/features/api-credentials/server/*.server.ts` 作为 credential 认证边界
  - `app/features/tasks/server/*` 中仅放可复用的任务创建领域逻辑，不把 route 细节反向塞回共享领域模块
- 数据库与迁移保持现有约束：
  - schema 变更只放 `database/schema/`
  - migration 变更只放 `drizzle/*.sql` 与 `drizzle/meta/*`
  - 新 migration 应承接当前 `0007_channel_preset_workbench.sql` 之后的顺序
- OpenAPI 契约单独放在 `docs/api/`，不要散落在 feature 目录

### Files To Read Before Coding

- `app/routes/workspace.tsx`
  - 当前状态：creator workspace 的统一 loader/action 入口
  - 本 story 要改：不要直接修改为 public API，但需理解其如何委托 `handleTaskIntakeAction`
  - 必须保留：现有 creator workflow 不回归
- `app/features/tasks/server/task-intake.server.ts`
  - 当前状态：已实现 preview / confirm / retry / review 等工作台任务动作，并会写入 `tasks` + `task_events`
  - 本 story 要改：抽取可复用任务创建核心，而不是复制 creator-only 分支逻辑
  - 必须保留：现有工作台任务创建、draft、requestId、事件账本行为
- `app/features/tasks/server/task-errors.server.ts`
  - 当前状态：偏工作台 action 的错误响应 helper
  - 本 story 要改：不要直接把该 helper 当成 public API 最终错误 contract
  - 必须保留：现有工作台表单错误行为
- `app/features/auth/server/request-context.server.ts`
  - 当前状态：统一生成/传递 `requestId`
  - 本 story 要改：复用其 request correlation，不另起第二套 request ID 机制
  - 必须保留：header -> context 的现有行为
- `database/schema/tasks.ts`
  - 当前状态：任务记录只有 `creator_user_id` 主体语义
  - 本 story 要改：根据最终设计补充 API 创建主体的持久化或快照追踪字段
  - 必须保留：现有工作台任务查询与测试兼容性
- `database/schema/auth.ts`
  - 当前状态：已有 `users` / `sessions` / `audit_logs` / `user_role_assignments`
  - 本 story 要改：新增 `api_credentials` 相关 schema，保持 auth schema 组织风格一致
  - 必须保留：既有 SSO/session/RBAC 表结构与引用关系

### Testing Requirements

- 必须新增或扩展自动化测试覆盖：
  - `POST /tasks` 成功返回最小成功 envelope
  - 无 credential / 无效 credential / 过期 credential / revoked credential
  - cookie-only 请求被拒绝
  - cookie + valid credential 时仅以 credential 主体授权
  - 请求字段缺失或格式错误返回 `422 TASK_REQUEST_INVALID`
  - 失败路径不泄露 `data`、`sourceIdentifier`、`presetResolution` 等受保护业务字段
- 必须保留并重新跑通现有回归：
  - `tests/task-intake.test.ts`
  - `tests/task-events.test.ts`
  - `tests/task-query.test.ts`
  - `tests/workspace-view.test.ts`
- 如果新增 route-level tests，优先对齐现有 `tests/api/health-route.test.mjs` 的 route 测试组织方式。

### Previous Story Intelligence

- Story 3.0 已把 failure / retry / review contract 收紧成共享内部语义；4.1 不应重新发明任务状态，也不应发明第二套 request tracing。
- Story 3.3 明确 support diagnostics 与 creator 视图隔离，且不暴露 deliverable 下载语义。4.1 的 public API 也必须保持同样的“最小外露”原则。
- Epic 3 合约矩阵已经说明：`Story 4.1` 依赖的是“现有内部状态与 auth boundary 已稳定”，不是“现有 public API 已存在”。4.1 的工作重点是外部入口和 contract 包装。

### Git / Migration Intelligence

- 当前工作树在 create-story 开始时是干净的，没有待处理脏改动。
- Drizzle 迁移序列当前到 `0007_channel_preset_workbench.sql`；本 story 如涉及 schema 变更，应继续顺序生成，不要手写跳号或重排旧 migration。

### Project Structure Notes

- 当前项目尚未存在 `project-context.md`，create-story 本次未加载到额外持久 facts 文件。
- 这不是阻塞项，但意味着实现必须更严格依赖现有代码、架构文档和 readiness 产物，而不是假设隐藏规则存在。

### References

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md` - Epic 4 / Story 4.1 原始需求与 AC
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md` - FR40-FR44、NFR9、NFR13-NFR15
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md` - External API Security Boundary、Error Handling Standard、Task Status Model、API Naming / Response Format、Observability
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/adr/002-openapi-ownership.md` - public OpenAPI checked-in ownership model
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-3-contract-test-matrix.md` - Epic 3 内部 contract 对 4.1 的依赖证明
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md` - 4.1 成功/错误 envelope 与字段映射
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-auth-test-strategy.md` - API credential 认证矩阵与 no-data-leak 规则
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md` - readiness 放行结论与 Epic 4 推荐顺序
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-checklist-2026-06-08.md` - Epic 4 gate checklist

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- create-story context load completed from epics, PRD, architecture, Epic 3 contract matrix, Epic 4 readiness artifacts, and current codebase.
- Implemented `api_credentials` schema, public API auth helper, `POST /tasks` route, and task create service with audit + request tracing.
- Added public OpenAPI contract and new API route tests covering success, unresolved preset, missing credential, expired credential, and invalid payloads.
- Validation results: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate` passed locally.
- 初次执行 `pnpm db:migrate` 时曾因沙箱网络限制报 `connect EPERM 9.134.57.221:5432`；在获得外部数据库执行许可后已成功完成迁移应用。

### Completion Notes List

- Story context created with explicit Epic 4 readiness inputs and API contract guardrails.
- Implemented an external `POST /tasks` route that authenticates only with `api_credentials`, rejects Web session substitution, and returns the Epic 4 success/error envelopes.
- Added `api_credentials` persistence plus `tasks.api_credential_id`, so API-created tasks keep both owner linkage and the exact API subject trace.
- Reused the existing task status/event model to create matched tasks as `created` and unresolved preset tasks as `awaiting_preset_decision`, without inventing a parallel state machine.
- Added checked-in public OpenAPI contract and contract tests for the new API surface.
- Verification completed successfully for `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate`.
- 在获得批准后，`pnpm db:migrate` 已对配置的 PostgreSQL 实例执行成功。

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-1-api-credential-validation-and-task-create-request.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/api-credentials/server/api-credential-auth.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/api-credentials/server/public-api-errors.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/api-task-create.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/api.tasks.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/server/env.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/auth.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/tasks.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/api/public-openapi.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/drizzle/0008_empty_liz_osborn.sql`
- `/Users/reuszeng/Code/Projects/Yakimoji/drizzle/meta/0008_snapshot.json`
- `/Users/reuszeng/Code/Projects/Yakimoji/drizzle/meta/_journal.json`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/api/health-route.test.mjs`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/api/tasks-route.test.mjs`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- No blocking findings after implementation fixes.
- Reviewed the API credential boundary, success/error envelope, route registration, and migration scope.
- The generated migration originally over-included previously existing tables/columns because of historical Drizzle meta gaps; this was corrected before finalizing review so `0008` now only contains Story 4.1 changes.

Decision:

- Approve. Story 4.1 satisfies the minimum Epic 4 create-task contract, API credential isolation, request tracing, and checked-in OpenAPI/test requirements.
- Note: `pnpm db:migrate` was later executed successfully against the configured PostgreSQL instance.

### Change Log

- 2026-06-08: Story artifact created from Epic 4 / Story 4.1 context with readiness review, API contract mapping, and readiness checklist as mandatory inputs.
- 2026-06-08: Implemented API credential authentication, public task-create route, OpenAPI contract, schema changes, and contract tests.
- 2026-06-08: BMAD code review completed with approval.
