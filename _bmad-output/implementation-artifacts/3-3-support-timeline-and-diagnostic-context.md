# Story 3.3: Support Timeline and Diagnostic Context

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 支持人员,
I want 查看任务未命中、失败、中断与人工介入的关键时间线和上下文,
so that 我能解释问题并协助定位原因，同时不破坏创作者视图与权限边界。

## Acceptance Criteria

1. **Given** 支持人员具备查看任务诊断信息的内部权限  
   **When** 支持人员打开某个任务的支持视图或等价诊断入口  
   **Then** 系统必须展示该任务的关键时间线与上下文信息  
   **And** 支持视图与普通创作者视图的权限边界必须清楚隔离
2. **Given** 某个任务曾发生预设未命中  
   **When** 支持人员查看该任务诊断信息  
   **Then** 系统必须能够显示该任务未命中频道预设的原因或分类说明  
   **And** 支持人员能够区分是未命中后继续、手动复用预设还是新建预设后继续
3. **Given** 某个任务处理失败或处理中断  
   **When** 支持人员查看该任务诊断信息  
   **Then** 系统必须展示失败或中断发生的关键阶段、原因分类和相关上下文  
   **And** 这些信息必须足以支持支持人员向用户解释卡在哪一步、为什么发生
4. **Given** 某个任务经历过人工覆盖或低置信度人工确认  
   **When** 支持人员查看该任务诊断信息  
   **Then** 系统必须能够展示相关人工操作记录  
   **And** 至少包括操作类型、对应任务上下文和发生时间
5. **Given** 某个任务有完整的状态流转历史  
   **When** 支持人员查看任务时间线  
   **Then** 系统必须按时间顺序展示关键状态节点  
   **And** 时间线内容应可把来源识别、预设命中结果、处理阶段变化、失败或中断和人工介入串成一条可解释链路
6. **Given** 支持人员无权查看某个任务或诊断信息  
   **When** 支持人员尝试访问对应支持视图  
   **Then** 系统必须拒绝越权访问  
   **And** 不得因支持界面存在而放宽任务、交付物或审计上下文的授权边界
7. **Given** 支持人员需要基于任务 ID 排查问题  
   **When** 支持人员搜索或打开该任务  
   **Then** 系统必须能基于任务 ID 读取相关状态与审计信息  
   **And** 这些记录至少满足系统已承诺保留的时间窗口

## Tasks / Subtasks

- [x] 基于 3.0 contract 定义 support 诊断查询与权限守卫 (AC: 1, 6, 7)
  - [x] 增加 support-only loader 或 service，显式校验支持权限
  - [x] 提供 task ID 查询入口与最小返回字段集
- [x] 组装 support timeline 和 diagnostic context (AC: 2, 3, 4, 5)
  - [x] 串联预设未命中/命中、失败、retry、人工确认、人工覆盖等关键节点
  - [x] 补充 reason category、attempt lineage 和人工操作记录
- [x] 渲染 support 视图或等价诊断入口 (AC: 1, 5, 7)
  - [x] 明确与 creator 视图区分
  - [x] 支持按 task ID 打开诊断信息
- [x] 补齐权限与回归测试 (AC: 2, 3, 4, 6, 7)
  - [x] 覆盖授权访问、越权拒绝、timeline 完整性和最小字段保障
  - [x] 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 本 story 交付 support 视角的可解释时间线，不扩大到全量运营后台。
- 重点是权限边界、关键上下文最小字段和 task ID 排障入口。

### Dependencies

- 依赖 Story 3.0 的 diagnostic contract。
- 复用 3.1 的 review 记录与 3.2 的失败/retry 上下文，统一汇入 support timeline。

### Current Codebase State

- 现有任务详情时间线更偏创作者视角，还没有 support-only 诊断入口与权限守卫。
- 任务快照已经保存部分 preset / baseline 上下文，是 support timeline 的基础来源之一。

### Testing Requirements

- 需要新增或扩展 support 权限与 timeline 查询测试。
- 必须显式验证未授权用户无法借道读取诊断上下文。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 73 tests.
- `pnpm build` passed.

### Completion Notes

- Added support diagnostic task detail mode that reads task state by task ID and projects a support-only timeline plus minimal diagnostic context.
- Kept creator and support shells visually separated so support-only users no longer see creator intake or preset management affordances.
- Support diagnostics intentionally omit deliverable download data while preserving timeline, preset resolution, attempt lineage, review, retry, and failure context.

### File List

- `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
- `app/features/tasks/components/TaskDetailPanel.tsx`
- `app/features/tasks/components/TaskSupportDiagnosticsCard.tsx`
- `app/features/tasks/server/task-diagnostics.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `app/features/tasks/server/workspace-view.server.ts`
- `app/shared/ui/WorkspaceShell.tsx`
- `tests/task-query.test.ts`
- `tests/workspace-view.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- Support 诊断入口现在按 task ID 读取最小上下文字段，并通过 support-only 模式与 creator 工作台分离。
- Support timeline 能串联 preset resolution、review、failure、retry 和 attempt lineage，而不会顺带暴露 deliverable 下载语义。
- 权限与 loader 行为已补齐回归覆盖，support-only detail 不再依赖 creator task list。

Decision:

- Approve。Story 3.3 已满足 support-only 诊断入口、时间线语义和权限边界的最小交付要求。

### Change Log

- 2026-06-08: Story artifact created from Epic 3 / Story 3.3 context.
- 2026-06-08: Implemented support diagnostic detail mode, support-only shell separation, and timeline/query regression coverage.
- 2026-06-08: BMAD code review completed with approval.
- 2026-06-20: Reconciled BMAD sprint tracking so sprint-status reflects the completed 3.3 support diagnostic delivery.
