# Story 3.2: Failure Explanation and Retry-to-New-Attempt Recovery

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在任务失败或中断时看到清楚的失败解释，并通过新 attempt 触发恢复,
so that 我能理解问题并采取明确的下一步，而不是在历史上下文被覆盖后盲目重试。

## Acceptance Criteria

1. **Given** 某个任务在处理链路中进入失败终态或处理中断  
   **When** 创作者查看任务列表或任务详情  
   **Then** 页面必须明确展示该任务已失败或中断  
   **And** 不能只显示模糊的异常状态而不说明任务当前处境
2. **Given** 创作者打开失败或中断的任务详情  
   **When** 页面展示异常说明模块  
   **Then** 系统必须指出失败发生的具体阶段  
   **And** 提供可读的失败原因说明，而不是只有内部错误码
3. **Given** 某个任务已经失败  
   **When** 创作者查看异常说明  
   **Then** 系统必须同时保留机器可读的原因代码与可追踪诊断标识  
   **And** 这些信息应能够与用户可见说明共存，而不是只暴露其中一类
4. **Given** 某个失败场景已经有明确恢复方式  
   **When** 创作者查看异常说明模块  
   **Then** 页面必须展示推荐恢复动作  
   **And** 推荐动作的优先级应高于其他替代路径，例如稍后处理或返回列表
5. **Given** 某个失败任务允许恢复  
   **When** 创作者选择重试恢复  
   **Then** 系统必须以创建新 attempt 或等价的新执行实例的方式继续处理  
   **And** 本 story 不要求支持步骤级续跑、补偿式恢复或多种恢复策略并存
6. **Given** 某个任务当前没有可用恢复动作  
   **When** 创作者查看异常说明模块  
   **Then** 页面必须清楚说明当前无法恢复或需要等待其他处理  
   **And** 不得展示误导性的可操作入口
7. **Given** 创作者多次返回失败任务查看原因  
   **When** 页面重新加载该任务的异常状态  
   **Then** 系统必须稳定呈现相同的失败阶段、原因说明和已知恢复选项  
   **And** 不得因为前端临时状态丢失而让失败解释变得不一致
8. **Given** 失败说明模块在工作台中渲染  
   **When** 创作者通过键盘、屏幕阅读器或普通桌面交互查看该模块  
   **Then** 失败原因、恢复动作和上下文信息必须具备清晰语义和可达性  
   **And** 关键错误解释不能仅依赖 toast 或瞬时提示承担
9. **Given** 创作者触发 retry 动作但服务端拒绝或执行失败  
   **When** 页面返回错误  
   **Then** 原失败解释、诊断标识与推荐恢复动作必须继续保留  
   **And** 创作者可以基于同一失败上下文再次判断是否重试

## Tasks / Subtasks

- [x] 基于 3.0 contract 落地失败解释视图模型 (AC: 1, 2, 3, 6, 7)
  - [x] 输出失败阶段、可读说明、reason code、trace id 与恢复能力
  - [x] 保持多次加载的解释一致性
- [x] 实现 retry-to-new-attempt 恢复动作 (AC: 4, 5, 9)
  - [x] 创建新 attempt 或等价执行实例
  - [x] 保留原失败 attempt、快照 lineage 与诊断上下文
  - [x] retry 失败时保留原异常说明而不是清空页面
- [x] 在工作台任务详情中渲染失败说明与恢复入口 (AC: 1, 2, 4, 6, 8)
  - [x] 明确展示推荐动作和不可恢复场景
  - [x] 保证可访问性和非 toast 依赖
- [x] 补齐回归测试与构建验证 (AC: 3, 5, 7, 8, 9)
  - [x] 覆盖失败详情稳定性、retry 成功、新 attempt lineage、retry 失败上下文保留
  - [x] 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 本 story 交付“可解释失败 + 明确恢复动作 + 新 attempt 重试”。
- 这里的恢复以新执行实例为核心，不修改历史失败 attempt 的上下文事实。

### Dependencies

- 依赖 Story 3.0 提供 failure/retry contract、reason code、trace id 和 attempt lineage 约束。
- Story 3.3 将复用这里的失败上下文与 retry 事件到 support timeline。

### Current Codebase State

- 当前任务状态与事件已经能表达 `failed`，但没有正式的失败说明视图模型或 retry lineage。
- 详情视图已有 timeline 和结果状态卡片，可扩展异常说明模块。

### Testing Requirements

- 优先扩展 `tests/task-query.test.ts` 和新增/扩展 failure-retry 相关服务端测试。
- 必须覆盖“retry 失败后仍保留异常上下文”的回归。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 73 tests.
- `pnpm build` passed.

### Completion Notes

- Added a stable failure explanation model exposing failure stage, human-readable message, reason code, trace id, and retry recommendation.
- Implemented retry-to-new-attempt recovery that creates a new task execution instance and records retry lineage in snapshots and events.
- Retry errors remain inline inside the task failure card, preserving the original failure context instead of replacing it with transient UI state.

### File List

- `_bmad-output/implementation-artifacts/3-2-failure-explanation-and-retry-to-new-attempt-recovery.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/tasks/components/TaskDetailPanel.tsx`
- `app/features/tasks/components/TaskFailureCard.tsx`
- `app/features/tasks/server/task-diagnostics.server.ts`
- `app/features/tasks/server/task-errors.server.ts`
- `app/features/tasks/server/task-events.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `tests/task-diagnostics.test.ts`
- `tests/task-query.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-08

Findings:

- Failure explanation now exposes both user-readable context and machine-readable diagnostics without forcing support to infer state from a single status label.
- Retry recovery preserves historical failure facts and creates a fresh queued attempt with explicit lineage.
- Retry UI remains request-scoped and inline, so rejected recovery actions do not erase the failure explanation context.

Decision:

- Approve。Story 3.2 已满足失败解释、稳定诊断标识和 new-attempt recovery 的核心要求。

### Change Log

- 2026-06-08: Story artifact created from Epic 3 / Story 3.2 context.
- 2026-06-08: Implemented failure explanation card, retry-to-new-attempt recovery flow, and retry lineage diagnostics.
- 2026-06-08: BMAD code review completed with approval.
