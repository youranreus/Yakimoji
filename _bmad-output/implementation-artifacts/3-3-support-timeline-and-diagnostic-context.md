# Story 3.3: Support Timeline and Diagnostic Context

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 支持人员,
I want 查看任务未命中、失败与中断的关键时间线和诊断上下文,
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
4. **Given** 某个任务有完整的状态流转历史  
   **When** 支持人员查看任务时间线  
   **Then** 系统必须按时间顺序展示关键状态节点  
   **And** 时间线内容应可把来源识别、预设命中结果、处理阶段变化与失败或中断串成一条可解释链路
5. **Given** 支持人员无权查看某个任务或诊断信息  
   **When** 支持人员尝试访问对应支持视图  
   **Then** 系统必须拒绝越权访问  
   **And** 不得因支持界面存在而放宽任务、交付物或审计上下文的授权边界

## Tasks / Subtasks

- [x] 基于 3.0 contract 定义 support 诊断查询与权限守卫 (AC: 1, 5)
  - [x] 增加独立 support-only loader 或 service，显式校验支持权限
  - [x] 避免通过 creator workspace/detail loader 间接读取诊断上下文
- [x] 组装 support timeline 和 diagnostic context (AC: 2, 3, 4)
  - [x] 串联预设未命中/命中、失败与 retry 等关键节点
  - [x] 补充未命中原因/分类、失败阶段/原因分类和 attempt lineage
- [x] 渲染独立 support 诊断视图 (AC: 1, 4, 5)
  - [x] 明确与 creator 视图区分
  - [x] 不混入 3.4 的 task ID 检索语义或 6.2 的审计记录语义
- [x] 补齐权限与回归测试 (AC: 1, 2, 3, 4, 5)
  - [x] 覆盖授权访问、越权拒绝、timeline 完整性和最小字段保障
  - [x] 运行 `pnpm typecheck`、`pnpm test`

## Dev Notes

### Story Intent

- 本 story 交付 support 视角的可解释时间线，不扩大到全量运营后台。
- 范围只包含独立 support 诊断视图，不包含 task ID 检索台账或人工介入审计清单。

### Dependencies

- 依赖 Story 3.0 的 diagnostic contract。
- 复用 3.1 的 review 记录与 3.2 的失败/retry 上下文，统一汇入 support timeline。

### Current Codebase State

- 现有仓库中存在把 support 诊断挂在 creator workspace detail 下的旧实现，需要改为独立支持视图。
- 任务快照已经保存部分 preset / baseline 上下文，是 support timeline 的基础来源之一。

### Testing Requirements

- 需要新增或扩展 support 权限与 timeline 查询测试。
- 必须显式验证未授权用户无法借道 creator 详情读取诊断上下文。

## Dev Agent Record

### Debug Log

- 2026-06-20: Reopened story because the previous implementation mixed 3.3 with 3.4/6.2 semantics.
- `pnpm typecheck` passed.
- `pnpm test` passed with 133 tests.

### Completion Notes

- Re-implemented 3.3 as a dedicated support diagnostic route instead of reusing the creator workspace detail shell.
- Added non-match reason category and explanatory context to the support diagnostic view so support can distinguish unresolved, manual reuse, manual create, and continue-without-preset paths.
- Restored the creator workspace boundary so support-only sessions can no longer read diagnostics through `/workspace/tasks/:taskId`.
- Kept the support view read-only and filtered diagnostic timeline events to the 3.3 scope so later audit/manual-intervention semantics stay out of this story.

### File List

- `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
- `app/features/tasks/components/TaskSupportDiagnosticScreen.tsx`
- `app/features/tasks/components/TaskSupportFailureCard.tsx`
- `app/features/tasks/components/TaskSupportDiagnosticsCard.tsx`
- `app/features/tasks/server/task-diagnostics.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `app/features/tasks/server/workspace-view.server.ts`
- `app/routes.ts`
- `app/routes/support.tasks.$taskId.diagnostics.tsx`
- `tests/e2e/workspace-shell.test.mjs`
- `tests/support-diagnostics-route.test.ts`
- `tests/task-query.test.ts`
- `tests/workspace-view.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-20

Findings:

- Dedicated support diagnostic route now owns the support-only surface and no longer leaks creator retry actions.
- Support diagnostics now include non-match reason semantics while filtering out later-story audit/manual-intervention events.
- Creator workspace access is again creator-only, so support diagnostics cannot be reached indirectly through `/workspace/tasks/:taskId`.

Decision:

- Approve。Story 3.3 现已满足独立 support 诊断视图、时间线语义与权限边界要求。

### Change Log

- 2026-06-08: Story artifact created from Epic 3 / Story 3.3 context.
- 2026-06-08: Implemented support diagnostic detail mode, support-only shell separation, and timeline/query regression coverage.
- 2026-06-08: BMAD code review completed with approval.
- 2026-06-20: Story reopened after scope audit found the previous implementation mixed 3.3 with 3.4 and 6.2 semantics.
- 2026-06-20: Re-implemented the story as a dedicated support diagnostic route and moved creator/support access back to separate surfaces.
- 2026-06-20: Re-ran code review, fixed support-surface leakage and later-story event bleed, then approved the story.
