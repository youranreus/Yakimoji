# Story 4.2: API Task Status and Result Query Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 外部集成方,
I want 查询任务状态和完成结果,
so that 我的系统能稳定追踪处理进度并消费交付结果。

## Acceptance Criteria

1. **Given** 外部系统已通过有效 API 凭证创建任务  
   **When** 外部系统调用任务状态查询接口  
   **Then** 系统必须返回该任务当前的统一顶层状态  
   **And** 该状态语义必须与 Yakimoji 内部公开状态模型保持一致
2. **Given** 某个任务正处于不同生命周期阶段  
   **When** 外部系统查询任务状态  
   **Then** 系统必须能够区分至少已进入处理、等待人工处理、处理失败、处理完成等关键状态  
   **And** 不得让外部系统依赖非正式字段推断任务所处阶段
3. **Given** 某个任务尚未完成  
   **When** 外部系统查询该任务  
   **Then** 系统必须返回统一的成功响应 envelope  
   **And** 响应内容必须足以让集成方继续轮询或等待后续结果，而不需要访问内部工作台上下文
4. **Given** 某个任务已经完成  
   **When** 外部系统调用任务结果查询接口  
   **Then** 系统必须返回统一的结果响应结构  
   **And** 至少包含任务 ID、终态状态、结果元数据与交付物访问方式
5. **Given** 某个任务存在成品视频或字幕等交付结果  
   **When** 外部系统读取结果响应  
   **Then** 响应必须以统一字段结构暴露可消费的结果信息  
   **And** 不得因不同交付物类型而返回彼此不兼容的 envelope
6. **Given** 同一 API 版本内的任务状态与结果接口持续演进  
   **When** 外部系统继续使用既有集成  
   **Then** 任务状态语义与关键字段含义必须保持向后兼容  
   **And** 任何破坏性语义变更都不能在同一版本内静默发生
7. **Given** 外部系统查询自己无权访问的任务或不存在的任务  
   **When** 系统执行 API 授权与存在性判断  
   **Then** 系统必须返回合适的受控响应  
   **And** 不得泄露其他任务的受保护业务数据
8. **Given** 外部系统频繁查询任务状态或结果  
   **When** 系统处理这些读取请求  
   **Then** 请求与响应必须具备稳定的 request_id 和可追踪上下文  
   **And** 该接口行为应支持后续合约测试与限流治理

## Tasks / Subtasks

- [x] 暴露 `GET /tasks/:taskId` 状态查询 contract，并复用现有统一状态真源 (AC: 1, 2, 3, 6, 7, 8)
  - [x] 新增外部 API status route，不复用 workspace detail route 直接对外暴露
  - [x] 把内部 `TaskStatus`、`statusLabel`、`attempt`、最小 `presetResolution` 投影成 Epic 4 mapping 指定的字段结构
  - [x] 对 `403 TASK_FORBIDDEN`、`404 TASK_NOT_FOUND`、认证失败路径保持统一错误 envelope 和 no-data-leak
- [x] 暴露 `GET /tasks/:taskId/result` 结果查询 contract，并复用现有 deliverable/result 读模型 (AC: 3, 4, 5, 6, 7, 8)
  - [x] 输出统一的 result envelope，至少包含 `taskId`、`status`、`result.state`、`deliverables`、`attempt`
  - [x] 将现有受控下载模型映射成 `download.method` + `download.href`，禁止返回长期裸 `downloadUrl`
  - [x] 对未完成/失败/无交付物等场景保持可测试的统一结果语义，而不是退化成临时字段或异常格式
- [x] 落实 API 任务级授权边界与可观测性 (AC: 1, 7, 8)
  - [x] 使用 Story 4.1 引入的 `tasks.api_credential_id` 作为外部 API 授权真源，确保 credential 只能读自己创建的任务
  - [x] 查询请求继续记录 `request_id`、`task_id`、`api_credential_id` 级别追踪上下文
  - [x] 维持 Web session 与 API credential 的隔离，不允许 cookie 为状态/结果查询加权
- [x] 补齐 OpenAPI 与 contract tests (AC: 1, 3, 4, 5, 6, 7, 8)
  - [x] 更新 `docs/api/public-openapi.yaml`，补齐 `GET /tasks/{taskId}` 和 `GET /tasks/{taskId}/result`
  - [x] 新增自动化测试覆盖：处理中、等待人工复核、已完成、无权访问、不存在任务、无 credential、过期 credential、交付物下载字段 contract
  - [x] 至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`；若环境可达，再运行 `pnpm db:migrate`

## Dev Notes

### Story Intent

- 本 story 负责把 Story 4.1 已建立的 API credential 边界扩展到“状态查询”和“结果查询”两个读取面。
- 重点不在于新造内部状态或新造结果模型，而在于把现有统一状态、attempt、failure、deliverable 语义稳定投影成外部 API contract。
- create-story 阶段必须继续以以下 readiness 产物为真源：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-checklist-2026-06-08.md`

### Readiness-Derived Contract Guardrails

- `epic-4-api-contract-mapping.md` 对 4.2 已收口两块核心 contract：
  - `GET /tasks/:taskId` 返回统一 `data.status`、`statusLabel`、`resultState`、`reviewState`、`attempt`、`presetResolution`
  - `GET /tasks/:taskId/result` 返回统一 `result.state`、`deliverables`、`attempt`，且 deliverable 访问方式是 `download.method` + `download.href`
- readiness review 已明确：
  - result query 不直接返回长期裸 `downloadUrl`
  - 4.2 不需要在实现时临时决定下载访问 contract
- auth strategy 对 4.2 的新增要求：
  - `foreign task -> 403 TASK_FORBIDDEN`
  - `missing task -> 404 TASK_NOT_FOUND`
  - failed / non-match 结果仍应走业务语义或统一 success envelope，不得退化成认证/授权错误

### Dependencies

- 依赖 Story 4.1 已交付的外部 API 入口基础：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-1-api-credential-validation-and-task-create-request.md`
  - `app/features/api-credentials/server/api-credential-auth.server.ts`
  - `app/features/tasks/server/api-task-create.server.ts`
  - `app/routes/api.tasks.ts`
- 依赖现有内部任务查询/结果读取能力：
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/deliverables/server/deliverable-query.server.ts`
  - `app/features/deliverables/server/deliverable-access.server.ts`
- 依赖 Epic 3 形成的内部 contract：
  - 统一状态语义
  - failure / attempt lineage
  - support/creator 权限边界

### Current Codebase State

- Story 4.1 已经提供了 public `POST /tasks`，并新增：
  - `api_credentials` schema
  - `tasks.api_credential_id`
  - 外部 API credential 认证 helper
  - public OpenAPI spec 基础骨架
- 当前还没有外部 API 的 `GET /tasks/:taskId` 或 `GET /tasks/:taskId/result` route。
- 当前内部已有可复用读模型，但它们偏 workspace / creator/support 语义：
  - `task-query.server.ts` 能组装统一状态、timeline、reviewQueue、failureContext、attempt、deliverables
  - `deliverable-query.server.ts` / `deliverable-access.server.ts` 已有受控下载与到期语义
  - 这些能力需要被“最小外露”地映射成 public API，而不是直接透出 workspace detail 全量结构
- Story 4.1 之后，授权真源已经具备：
  - `tasks.api_credential_id`
  - request-scoped auth audit
  - API credential 与 Web session 隔离

### Implementation Guardrails

- 不允许直接把 workspace detail 的完整 payload 当作 public API 返回；必须显式筛选为 Epic 4 mapping 定义的最小 contract。
- 不允许在 result query 中返回裸 `downloadUrl`；必须继续走受控下载 endpoint 描述。
- 不允许用 creator user 所属关系替代 `api_credential_id` 做外部 API 授权。对于 public API，任务可见性真源应是“该任务是否由当前 credential 创建/拥有访问权”。
- 不允许为外部 API 发明第二套状态枚举或 result status 枚举；必须继续复用既有 `TaskStatus` 真源并在投影层做稳定字段映射。
- 不允许在 4.2 提前扩 scope 到 4.3 的完整 failure / non-match 统一外露结构；4.2 只需给 status/result query 奠定可兼容的最小 contract。

### Architecture Compliance

- 状态接口与结果接口必须继续遵循统一成功/错误 envelope。
- API JSON 字段使用 `camelCase`；数据库字段保持 `snake_case`。
- 状态语义必须和 Web 工作台使用同一套 `TaskStatus` 枚举，不允许出现 API 专用状态别名。
- 受控下载 contract 必须与既有交付物保护模型兼容，不能把存储实现细节外露到 public API。

### File Structure Requirements

- 新增外部 API route 预计至少包含：
  - `app/routes/api.tasks.$taskId.ts`
  - `app/routes/api.tasks.$taskId.result.ts`
- credential 授权与错误 envelope 继续复用 4.1 已有模块，不另起第三套 auth/error helper。
- 状态/结果投影逻辑优先沉到 `app/features/tasks/server/` 或 `app/features/deliverables/server/` 的 server-only 组合层，而不是塞进 route 文件。
- OpenAPI 继续只维护在 `docs/api/public-openapi.yaml`。

### Files To Read Before Coding

- `app/features/api-credentials/server/api-credential-auth.server.ts`
  - 当前状态：已能解析 Bearer credential、校验缺失/无效/过期/停用，并记录审计
  - 本 story 要改：继续复用，不要复制 auth boundary
  - 必须保留：401/403 错误码与 no-data-leak 行为
- `app/features/tasks/server/task-query.server.ts`
  - 当前状态：已能读取统一状态、attempt、reviewQueue、failureContext、deliverables 与 timeline
  - 本 story 要改：提炼 public API status/result 所需的最小字段映射
  - 必须保留：workspace creator/support 现有读模型与权限行为
- `app/features/deliverables/server/deliverable-query.server.ts`
  - 当前状态：已能识别 ready/expired deliverable 与最小交付物视图
  - 本 story 要改：将下载访问方式投影为 `download.method` + `download.href`
  - 必须保留：现有受控下载、过期拒绝与 task 关联校验
- `app/routes/api.tasks.ts`
  - 当前状态：Story 4.1 的 public `POST /tasks`
  - 本 story 要改：保持其 contract 稳定，不要把读取逻辑揉进创建 route
  - 必须保留：4.1 新增 contract tests 继续通过

### Testing Requirements

- 必须新增或扩展自动化测试覆盖：
  - status query: `created` / `processing` / `awaiting_human_review` / `completed`
  - result query: `not_ready` / `ready` / `expired`
  - `403 TASK_FORBIDDEN`
  - `404 TASK_NOT_FOUND`
  - 缺失/无效/过期 credential
  - deliverable `download.method` + `download.href` contract
- 必须保留并重新跑通：
  - `tests/api/tasks-route.test.mjs`
  - `tests/task-query.test.ts`
  - `tests/deliverables.test.ts`
  - `tests/task-events.test.ts`

### Previous Story Intelligence

- Story 4.1 已把 public API 的认证边界和错误 envelope 固定下来；4.2 不应回退到 `{ ok: false }` 风格，也不应再次把 Web session 纳入鉴权判断。
- Story 4.1 已把 API-created task 与 `api_credential_id` 绑定；4.2 的任务读取授权应直接消费这一事实，而不是临时拼 ownerUserId-only 逻辑。
- Story 4.1 的 contract tests 已经覆盖 create path 的 no-data-leak；4.2 要把同样原则扩展到 query path。

### Git / Migration Intelligence

- 当前代码库已新增 `drizzle/0008_empty_liz_osborn.sql` 和 `drizzle/meta/0008_snapshot.json`。
- 该 migration 在 code review 中已经从“过度生成旧表/旧字段”修正为只包含 Story 4.1 的真实 schema 变更；4.2 继续演进 schema 时必须基于修正后的 migration 状态，而不是重新接受过宽 SQL。

### Project Structure Notes

- 当前项目仍没有 `project-context.md`。
- 4.2 的实现必须更加显式地把“外部 API 最小 contract”和“内部 workspace detail 读模型”分层，不要依赖隐式团队约定。

### References

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md` - Epic 4 / Story 4.2 原始需求与 AC
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md` - FR40-FR44、NFR6、NFR13-NFR15
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md` - Task Status Model、Error Handling Standard、External API Boundary、Asset Protection Model
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/adr/002-openapi-ownership.md` - public OpenAPI ownership
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-3-contract-test-matrix.md` - 4.2 所依赖的内部 contract 证据
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md` - status/result query 字段映射与 deliverable access contract
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-auth-test-strategy.md` - 4.2 的 auth/forbidden/not-found query matrix
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-1-api-credential-validation-and-task-create-request.md` - 4.1 现有实现与 guardrails

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story 4.2 context synthesized from Epic 4 epics/PRD/architecture, Epic 3 contract matrix, Epic 4 readiness artifacts, Story 4.1 artifact, and current repository files.
- Implemented public status/result query services and three API routes for status lookup, result lookup, and controlled deliverable download.
- Added contract tests for awaiting human review, expired result state, failed result state, task not found, expired credential, expired deliverable, and download read failure.
- Validation results: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate` passed locally.
- `pnpm db:migrate` 初次在沙箱内因 `connect EPERM 9.134.57.221:5432` 失败；在后续获得对外部 PostgreSQL 实例的执行许可后，迁移已成功完成。

### Completion Notes List

- Story context created with explicit dependency on Story 4.1 API credential boundary and OpenAPI ownership.
- Added external `GET /tasks/:taskId` and `GET /tasks/:taskId/result` contracts that project the existing internal task status, review state, attempt lineage, and preset resolution into the public API envelope.
- Added a controlled API deliverable download route that exposes `download.method` + `download.href` without leaking workspace-only download URLs.
- Enforced task ownership through `tasks.api_credential_id`, keeping API credential access isolated from Web session cookies.
- Expanded contract coverage for processing, awaiting human review, completed, failed, forbidden, not found, missing credential, expired credential, expired deliverable, and public 500 download failure envelopes.
- Code review found one patchable issue in the download failure path; it was fixed by returning a public API 500 envelope and adding deliverable-level audit outcomes for not found, expired, not ready, read failed, and success.
- Verification completed successfully for `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate`.
- 后续已在获得许可的环境下成功执行 `pnpm db:migrate`，不再存在迁移待执行项。

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-2-api-task-status-and-result-query-contract.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/api-task-query.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/api.tasks.$taskId.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/api.tasks.$taskId.result.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/api.tasks.$taskId.result.deliverables.$deliverableId.download.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/api/public-openapi.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/api/tasks-query-routes.test.mjs`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- Initial review identified one patchable issue: the public deliverable download route surfaced unwrapped 500 errors on file read failure and lacked deliverable-level audit outcomes for error paths.
- That patch was applied during the review, and the route now returns the public API error envelope with request-scoped metadata for download read failures.
- No blocking or remaining medium-severity findings after the patch and re-verification.

Decision:

- Approve. Story 4.2 satisfies the public status/result query contract, controlled deliverable access contract, API credential authorization boundary, and checked-in OpenAPI/test requirements.
- Note: `pnpm db:migrate` was later executed successfully with explicit approval against the configured PostgreSQL instance.

### Change Log

- 2026-06-08: Story artifact created from Epic 4 / Story 4.2 context with Story 4.1 implementation state and Epic 4 readiness documents as mandatory inputs.
- 2026-06-08: Implemented public task status/result query routes, controlled deliverable download route, OpenAPI updates, and expanded API contract tests.
- 2026-06-08: BMAD code review completed; patched public download failure envelope and deliverable audit outcomes; story approved.
