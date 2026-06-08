# Story 4.3: Structured Failure and Non-match API Responses

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 外部集成方,
I want 在失败、中断或未命中预设时拿到统一结构化响应,
so that 我的系统能在自己的流程里稳定分流异常和人工介入分支，而不是依赖临时文案猜测。

## Acceptance Criteria

1. **Given** 某个通过外部 API 创建的任务在处理链路中失败或中断  
   **When** 外部系统查询该任务状态或结果  
   **Then** 系统必须返回统一结构化的失败语义  
   **And** 至少包含任务 ID、当前状态、原因代码、失败阶段与可读说明
2. **Given** 某个任务在来源识别后未命中频道预设  
   **When** 外部系统查询该任务状态  
   **Then** 系统必须以结构化方式暴露该任务处于未命中预设的业务分支  
   **And** 外部系统能够明确区分该场景与普通处理中、普通失败或已完成
3. **Given** 外部系统依赖异常语义做自动化分支处理  
   **When** 系统返回失败、中断或未命中预设信息  
   **Then** 不同异常场景必须共享统一 success/error envelope  
   **And** 集成方不需要为每一类异常另写完全不同的解包逻辑
4. **Given** 某个失败场景已经有 machine-readable 原因代码与诊断信息  
   **When** 外部系统读取响应  
   **Then** 原因代码、失败阶段、是否可重试与建议动作必须稳定可测试  
   **And** 同时提供面向人工排障的可读说明
5. **Given** 某个任务曾经失败或未命中预设，随后又进入新的恢复或后续状态  
   **When** 外部系统继续查询该任务  
   **Then** 系统必须以最新真实状态为准返回结果  
   **And** 不得因为历史失败或未命中而永久停留在过期的异常描述
6. **Given** 外部系统查询失败/未命中相关任务  
   **When** 请求通过 API 认证与授权检查  
   **Then** 响应必须继续遵守统一 API 契约、认证边界与 `request_id` 可追踪要求  
   **And** 不得因为异常路径绕过既有认证、授权、no-data-leak 或审计约束
7. **Given** 团队对外维护该 API 集成契约  
   **When** 对失败、中断或未命中响应进行自动化验证  
   **Then** 这些场景必须可通过合约测试稳定校验  
   **And** 不允许异常路径成为 undocumented 行为或临时返回格式

## Tasks / Subtasks

- [x] 在 `GET /tasks/:taskId` 状态查询中补齐 structured failure 与 non-match contract (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 对 `status in [failed, cancelled]` 暴露 `data.failure`，至少包含 `reasonCode`、`stage`、`message`、`diagnosticTraceId`、`retryable`、`recommendedAction`
  - [x] 对 `status = awaiting_preset_decision` 且 `presetResolution.status = unresolved` 暴露 `presetResolution.nextAction` + `presetResolution.message`
  - [x] 保持外部 API 使用统一成功 envelope，不把 failure / non-match 误建模成 transport-level error
- [x] 在 `GET /tasks/:taskId/result` 结果查询中补齐失败终态的结构化 failure 语义 (AC: 1, 3, 4, 5, 6, 7)
  - [x] 对 failed/cancelled 任务继续返回 `200` 成功 envelope，并补齐 `data.failure`
  - [x] 保持 4.2 已有 `result.state`、`deliverables`、`attempt` contract 向后兼容
  - [x] 不强制把 non-match 在 `/result` 重复暴露，除非实现不引入第二套分支语义
- [x] 规范 failure stage 与 non-match 映射，复用现有内部真源而不新增平行语义 (AC: 1, 2, 4, 5, 7)
  - [x] 将内部 `failureContext.stage` 规范化为 readiness review 已固定的外部英文枚举
  - [x] 复用现有 `reasonCode`、`diagnosticTraceId`、attempt lineage 与 preset snapshot，不复制第二套诊断模型
  - [x] 未识别 failure stage 统一回退到 `processing`，避免 API 枚举漂移
- [x] 补齐 OpenAPI、审计与 contract tests (AC: 3, 4, 6, 7)
  - [x] 更新 `docs/api/public-openapi.yaml`，为 status/result 增补 `failure` 与扩展后的 `presetResolution` schema
  - [x] 新增自动化测试覆盖：failed、cancelled、retryable/non-retryable、unresolved non-match、历史失败后恢复、foreign task、missing task、缺失/无效/过期 credential、no-data-leak
  - [x] 至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`；若环境可达，再运行 `pnpm db:migrate`

## Dev Notes

### Story Intent

- 本 story 负责把 Epic 3 内部已经稳定的 failure / retry / non-match 语义，收敛成外部 API 可程序消费的最小结构化 contract。
- 4.2 已经完成 status/result 查询的基础 envelope、授权边界和 deliverable 访问 contract；4.3 不应推翻这些 contract，只在其上补 failure 与 unresolved non-match 结构。
- create-story 阶段必须继续以下列 readiness 产物为真源：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-checklist-2026-06-08.md`

### Readiness-Derived Contract Guardrails

- `epic-4-readiness-review-2026-06-08.md` 已固定：
  - Story 开发顺序必须是 `4.1 -> 4.2 -> 4.3`
  - `failure.stage` 外部枚举不再待定
  - `non-match` 必须在 `/tasks/:taskId` 暴露
  - `non-match` 是否在 `/tasks/:taskId/result` 重复暴露是非阻塞的窄决策，最小实现不强制
- `epic-4-api-contract-mapping.md` 对 4.3 已收口两块核心 contract：
  - failed/cancelled 任务通过 `data.failure` 暴露 `reasonCode`、`stage`、`message`、`diagnosticTraceId`、`retryable`、`recommendedAction`
  - unresolved non-match 通过 `status = awaiting_preset_decision` + `presetResolution.status = unresolved` 表达，而不是走错误 envelope
- `epic-4-readiness-checklist-2026-06-08.md` 已明确 4.3 开工前需要可引用的 failure mapping、non-match mapping、request_id 位置与 auth boundary 约束，这些内容已经在 readiness 产物中完成，dev-story 不应再次临时决定字段名或 envelope

### Dependencies

- 依赖 Story 4.2 已交付的外部读取基础：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-2-api-task-status-and-result-query-contract.md`
  - `app/features/tasks/server/api-task-query.server.ts`
  - `app/routes/api.tasks.$taskId.ts`
  - `app/routes/api.tasks.$taskId.result.ts`
  - `docs/api/public-openapi.yaml`
- 依赖 Epic 3 已稳定的内部 failure / retry / diagnostics 真源：
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-events.server.ts`
  - `tests/task-diagnostics.test.ts`
  - `tests/task-query.test.ts`
  - `tests/task-events.test.ts`
- 依赖 Story 4.1 已落地的 API credential 边界：
  - `app/features/api-credentials/server/api-credential-auth.server.ts`
  - `app/features/api-credentials/server/public-api-errors.server.ts`
  - `tasks.api_credential_id`

### Current Codebase State

- Story 4.2 已经提供：
  - `GET /tasks/:taskId`
  - `GET /tasks/:taskId/result`
  - `GET /tasks/:taskId/result/deliverables/:deliverableId/download`
  - public OpenAPI spec 与基础 contract tests
- 当前 public status/result query 仍有 4.3 的明确缺口：
  - `GET /tasks/:taskId` 只返回 `presetResolution.status`，还没有 `nextAction` / `message`
  - `GET /tasks/:taskId` 对 failed/cancelled 只暴露 `resultState = failed`，还没有结构化 `failure`
  - `GET /tasks/:taskId/result` 对 failed/cancelled 只返回 `result.state = failed`，还没有 `data.failure`
- 当前内部真源已经存在：
  - `extractFailureContext()` 能读出 `stage`、`message`、`reasonCode`、`diagnosticTraceId`、`retryable`、`recommendedAction`
  - `task-query.server.ts` 已在 creator/support 读模型里接出 `failureContext`
  - `presetSnapshot.status = unresolved` 与 `status = awaiting_preset_decision` 已在 4.1 create path 中形成真实数据
- 现有 failure stage 仍是内部中文/展示语义：
  - `task-diagnostics.server.ts` 返回的 `failureContext.stage` 目前未规范化为外部英文枚举
  - 4.3 必须在 public projection 层完成规范化，不能直接把内部文案透出为 API contract

### Implementation Guardrails

- 不允许把 failure / non-match 误建模成 `4xx` 业务错误；它们是成功 envelope 内的业务分支语义。
- 不允许新增第二套 failure/retry/non-match 状态模型；必须复用 `failureContext`、attempt、preset snapshot 等既有真源。
- 不允许把 support-only 字段直接外露给 public API，例如：
  - `supportCategory`
  - `supportDiagnostics.entries`
  - 原始事件 payload
  - 内部工作台说明文案
- 不允许改变 4.2 已稳定的字段含义，例如：
  - `data.status`
  - `data.result.state`
  - `data.attempt`
  - deliverable `download.method` + `download.href`
- 不允许在 4.3 临时扩 scope 到 callback、事件流、review item 明细或 support diagnostics endpoint。

### Architecture Compliance

- 所有 public API JSON 字段保持 `camelCase`；数据库字段保持 `snake_case`。
- 统一成功 envelope 继续使用 `{ data, meta }`；统一错误 envelope 继续使用 `{ request_id, error }`。
- `failure.stage` 外部枚举必须固定为：
  - `source_resolution`
  - `preset_matching`
  - `queueing`
  - `processing`
  - `human_review`
  - `subtitle_generation`
  - `deliverable_packaging`
  - `result_delivery`
- 未识别内部 failure stage 必须回退到 `processing`，避免同一版本内静默增加新枚举。

### File Structure Requirements

- 4.3 优先继续在现有 public query 组合层增量实现，而不是再起新 route：
  - `app/features/tasks/server/api-task-query.server.ts`
  - `app/routes/api.tasks.$taskId.ts`
  - `app/routes/api.tasks.$taskId.result.ts`
- OpenAPI 继续只维护在：
  - `docs/api/public-openapi.yaml`
- 优先在现有 `tests/api/tasks-query-routes.test.mjs` 扩展 4.3 contract matrix，避免分散到多套 API route test 入口。

### Files To Read Before Coding

- `app/features/tasks/server/api-task-query.server.ts`
  - 当前状态：已输出 4.2 的 status/result query contract 与受控下载 contract
  - 本 story 要改：在 projection 层增补 `failure` 与扩展后的 `presetResolution`
  - 必须保留：任务级授权、统一 envelope、request tracing、deliverable download contract
- `app/features/tasks/server/task-diagnostics.server.ts`
  - 当前状态：`extractFailureContext()` 已提供 failure 真源，但 `stage` 仍是内部展示语义
  - 本 story 要改：基于其输出做外部 failure stage normalization
  - 必须保留：`reasonCode`、`diagnosticTraceId`、`retryable`、`recommendedAction` 的现有语义
- `app/features/tasks/server/task-query.server.ts`
  - 当前状态：creator/support detail 已能组装 `failureContext` 与 preset context
  - 本 story 要改：只复用其读模型，不回退到 workspace 全量 payload 暴露
  - 必须保留：creator/support 现有读模型行为和权限隔离
- `app/features/tasks/server/api-task-create.server.ts`
  - 当前状态：unresolved preset 会把任务推进到 `awaiting_preset_decision`
  - 本 story 要改：理解 non-match 真源，不修改 4.1 create contract
  - 必须保留：4.1 create API 行为和 tests

### Testing Requirements

- 必须新增或扩展自动化测试覆盖：
  - status query: failed 任务返回结构化 `failure`
  - result query: failed/cancelled 任务返回结构化 `failure`
  - failure stage normalization 到固定英文枚举
  - unresolved non-match 返回 `presetResolution.status` + `nextAction` + `message`
  - 历史失败后恢复到 processing/completed 时，不再返回过期 failure contract
  - foreign task / missing task / missing credential / invalid credential / expired credential
  - failure / non-match 路径的 no-data-leak 与 `request_id`
- 必须保留并重新跑通：
  - `tests/api/tasks-query-routes.test.mjs`
  - `tests/task-diagnostics.test.ts`
  - `tests/task-query.test.ts`
  - `tests/task-events.test.ts`
- 若无 schema 变更，`pnpm db:generate` 应保持 no-op；若误触发 migration 变化，需要先解释原因再处理。

### Previous Story Intelligence

- Story 4.1 已固定 public API 的认证边界与错误 envelope；4.3 不能因为异常路径回退到 `{ ok: false }` 或 workspace 风格错误响应。
- Story 4.2 已固定 status/result 的最小 query contract；4.3 必须做向后兼容增量，而不是重写 4.2 response shape。
- 4.2 code review 已补齐 deliverable download 的 public 500 envelope 与 deliverable-level 审计；4.3 不应破坏这一修复后的 contract。

### Git / Migration Intelligence

- 当前 Epic 4 migration 基线仍是 Story 4.1 留下的 `drizzle/0008_empty_liz_osborn.sql` 与 `drizzle/meta/0008_snapshot.json`。
- 4.3 预计是纯 API projection / OpenAPI / test story，正常情况下不应引入新的 schema 变更。

### Project Structure Notes

- 当前项目仍没有 `project-context.md`。
- 4.3 的 create-story 需要显式依赖 readiness 产物和现有代码真源，不能假设额外隐藏约定存在。

### References

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md` - Epic 4 / Story 4.3 原始需求与 AC
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md` - FR40-FR44、NFR6、NFR13-NFR15
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md` - Error Handling Standard、External API Boundary、Task Status Model
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/adr/002-openapi-ownership.md` - public OpenAPI ownership
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-3-contract-test-matrix.md` - 4.3 所依赖的内部 failure/retry/non-match 证据
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-contract-mapping.md` - structured failure / non-match mapping 真源
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-api-auth-test-strategy.md` - 4.3 的 auth/no-data-leak/query matrix
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md` - readiness 放行结论与 4.3 最小 contract 决策
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-checklist-2026-06-08.md` - readiness gate checklist
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-2-api-task-status-and-result-query-contract.md` - 4.2 已交付读取 contract 与 guardrails

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story 4.3 context synthesized from Epic 4 epics/PRD/architecture, Epic 4 readiness artifacts, Epic 3 contract matrix, Story 4.2 artifact, and current repository files.
- Implemented public `failure` projection for status/result query and extended unresolved preset responses with `nextAction` and `message`.
- Added failure stage normalization to the fixed external enum set and stable recommended-action mapping for retryable/cancelled branches.
- Expanded API contract tests for unresolved non-match, failed/cancelled failure payloads, stale failure suppression after recovery, invalid credential, and existing 4.2 query/download regression paths.
- Validation results: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate` passed locally with no schema changes.
- Story 4.3 本身没有新增 schema 变更；Epic 4 的 `pnpm db:migrate` 已在后续获得许可后成功执行完成。

### Completion Notes List

- Story context created with explicit dependency on 4.2 query contract stability and 4.3 failure/non-match mapping guardrails.
- Public status/result query now return structured `failure` payloads for failed/cancelled tasks while preserving the 4.2 success envelope and `result.state` semantics.
- Unresolved preset decisions now surface stable `presetResolution.nextAction` and `presetResolution.message` fields on the status query contract instead of forcing integrators to infer the branch from status text.
- Failure stages are normalized into the fixed external enum set, and stale historical failure context is suppressed once a task has recovered into a newer real status.
- OpenAPI and contract tests were expanded without introducing schema changes; `pnpm db:generate` remained a no-op.

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/4-3-structured-failure-and-non-match-api-responses.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/api-task-query.server.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/docs/api/public-openapi.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/api/tasks-query-routes.test.mjs`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- Blind Hunter: no transport/error-envelope regressions found after checking the new failure/non-match fields against existing 4.2 query semantics.
- Edge Case Hunter: normalization fallback for unknown failure stages, cancelled-task fallback semantics, and stale historical failure suppression are covered by the final implementation and tests.
- Acceptance Auditor: implementation matches the readiness-mapped 4.3 intent by keeping failure/non-match on the success envelope, preserving auth/no-data-leak behavior, and not forcing `/tasks/:taskId/result` to duplicate unresolved non-match semantics.

Decision:

- Approve. Story 4.3 satisfies the structured failure and unresolved non-match API contract while preserving Story 4.2 compatibility.
- Note: Story 4.3 did not introduce new schema changes, and Epic 4 migrations were later applied successfully to the configured PostgreSQL instance.

### Change Log

- 2026-06-08: Story artifact created from Epic 4 / Story 4.3 context with readiness review, API contract mapping, and readiness checklist as mandatory inputs.
- 2026-06-08: Implemented structured failure and unresolved non-match public API projections, OpenAPI updates, and contract tests.
- 2026-06-08: BMAD code review completed with approval; no further patch findings remained after verification.
