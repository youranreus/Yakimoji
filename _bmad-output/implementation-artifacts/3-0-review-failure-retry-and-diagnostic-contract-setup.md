# Story 3.0: Review Failure Retry and Diagnostic Contract Setup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 开发团队,
I want 在 Epic 3 的 UI 开发前先统一 review、failure、retry 与 support diagnostic 的共享 contract,
so that 3.1、3.2、3.3 不会各自发明局部事件语义并破坏后续可解释性。

## Acceptance Criteria

1. **Given** Epic 3 的 review、failure、retry 与 support timeline 都依赖任务事件和状态  
   **When** 团队进入 Story 3.1~3.3 开发前  
   **Then** 系统必须先定义一份共享事件 contract  
   **And** 至少覆盖 `task.review_required`、`task.review_resolved`、`task.failed`、`task.retry_requested`、`task.retry_spawned` 与 support timeline entry 的命名和 payload 语义
2. **Given** 任务存在顶层生命周期状态与细粒度事件账本  
   **When** Story 3.0 定义 Epic 3 contract  
   **Then** contract 必须保持两者边界清晰  
   **And** 不得把 support 解释字段或 review 细节硬塞进顶层 task status
3. **Given** 失败恢复要求以新 attempt 或等价执行实例继续处理  
   **When** Story 3.0 定义 retry contract  
   **Then** contract 必须明确 attempt lineage、carry-forward snapshot 与失败上下文保留规则  
   **And** 不得通过覆盖旧 attempt 状态来伪装恢复成功
4. **Given** Story 3.1 需要面向创作者显示低置信度 review 队列  
   **When** Story 3.0 定义 review 资源和动作 contract  
   **Then** 必须明确 review item 的字段、确认动作输入、提交结果以及失败时如何保留上下文  
   **And** 该 contract 应聚焦片段确认，不扩展成完整编辑器协议
5. **Given** Story 3.3 需要 support 视角的诊断时间线  
   **When** Story 3.0 定义 diagnostic contract  
   **Then** 必须明确支持视图最小字段集、权限边界与 task ID 查询入口  
   **And** 未授权用户不得通过普通创作者 loader 间接读取诊断上下文
6. **Given** Epic 3 需要稳定解释失败原因与恢复建议  
   **When** Story 3.0 定义 failure contract  
   **Then** 必须同时支持用户可见说明、机器可读 reason code 与追踪诊断标识  
   **And** 这些字段在失败、重试失败与多次返回详情时都必须保持稳定
7. **Given** 共享 contract 一旦定义将被多个 story 复用  
   **When** Story 3.0 完成  
   **Then** 必须补齐对应的服务端单测或查询层测试，锁定事件语义、attempt lineage 和权限边界  
   **And** 3.1~3.3 的实现必须建立在这些测试已存在的基础上

## Tasks / Subtasks

- [x] 盘点 Epic 3 现有任务状态、事件模型与详情/支持查询缺口 (AC: 1, 2, 5, 6)
  - [x] 审查 `task-status.server.ts`、`task-events.server.ts`、`task-query.server.ts` 与数据库 schema
  - [x] 标出哪些字段已经存在，哪些 Epic 3 共享字段仍缺失
- [x] 定义 review、failure、retry 与 diagnostic 的共享 contract (AC: 1, 2, 3, 4, 5, 6)
  - [x] 统一事件命名、payload shape、reason code 与 trace id 语义
  - [x] 定义 review item、retry attempt lineage 和 support timeline entry 的最小字段集
  - [x] 明确失败动作和重试动作在错误时必须保留当前上下文
- [x] 将共享 contract 落到正式代码结构 (AC: 1, 2, 3, 5, 6)
  - [x] 扩展 task event 类型、共享类型定义和必要的 schema 字段
  - [x] 新增或调整 server helpers，避免后续 story 分别重复实现事件格式
- [x] 建立 Epic 3 的基础测试护栏 (AC: 3, 5, 6, 7)
  - [x] 为事件语义、attempt lineage、失败解释稳定性添加测试
  - [x] 为 support 视图权限边界和 task ID 查询入口添加测试
- [x] 更新 sprint 状态与 story artifact 追踪 (AC: 7)
  - [x] 完成后将 story 状态切到 `review`
  - [x] 在 File List 和 Change Log 中记录所有共享文件变更

## Dev Notes

### Story Intent

- 这是 Epic 3 的前置 contract-first story，不直接交付完整创作者 UI 或 support 视图。
- 目标是把 3.1、3.2、3.3 依赖的共享语义先固化，否则后面会演变成三套不兼容实现。

### Context Sources

- Epic 3 主体需求来自 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
- 前置补充来自 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-2-retro-2026-06-03.md`
- 现有任务事件与状态实现位于 `app/features/tasks/server/task-events.server.ts`、`task-status.server.ts` 与 `task-query.server.ts`

### Architecture Guidance

- 继续保持顶层 `tasks.status` 表示产品级生命周期，细粒度解释进入 `task_events`。
- Retry 必须通过新 attempt 或等价执行实例实现，保留旧失败上下文与快照 lineage。
- Support 诊断入口必须显式做权限检查，不能直接复用 creator-only loader。

### Testing Requirements

- 至少补齐 `tests/task-events.test.ts`、`tests/task-query.test.ts` 或等价测试覆盖。
- 完成后运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 73 tests.
- `pnpm build` passed.

### Completion Notes

- Introduced a shared Epic 3 diagnostic contract covering review, failure, retry, attempt lineage, and support timeline entries.
- Extended task events, task detail read models, and workspace loaders so later Epic 3 stories consume the same contract instead of inventing local payloads.
- Added baseline regression coverage for review queue normalization, failure semantics, retry lineage, and support-only diagnostic access.

### File List

- `_bmad-output/implementation-artifacts/3-0-review-failure-retry-and-diagnostic-contract-setup.md`
- `_bmad-output/implementation-artifacts/3-1-low-confidence-review-queue-for-creators.md`
- `_bmad-output/implementation-artifacts/3-2-failure-explanation-and-retry-to-new-attempt-recovery.md`
- `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/features/tasks/server/task-diagnostics.server.ts`
- `app/features/tasks/server/task-errors.server.ts`
- `app/features/tasks/server/task-events.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `app/features/tasks/server/workspace-view.server.ts`
- `tests/task-diagnostics.test.ts`
- `tests/task-query.test.ts`
- `tests/workspace-view.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- Shared Epic 3 event contract now covers review, failure, retry, and support diagnostics through a single helper layer and task event vocabulary.
- Retry lineage preserves `originTaskId`, increments `attemptNumber`, and records `retry_requested` plus `retry_spawned` events without mutating historical failure context.
- Support-only users no longer see creator intake or preset management affordances when opening diagnostic task detail by task ID.

Decision:

- Approve。Story 3.0 的 contract-first 目标已完成，并为 3.1~3.3 提供了统一基础。

### Change Log

- 2026-06-08: Story artifact created from Epic 3 retrospective hardening requirements.
- 2026-06-08: Implemented shared Epic 3 review/failure/retry/diagnostic contract, tests, and support-only shell separation.
- 2026-06-08: BMAD code review completed with approval.
