# Story 3.1: Low-confidence Review Queue for Creators

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在任务需要人工确认时看到低置信度片段及其上下文并完成必要确认,
so that 我能继续推进当前任务，而不是重新建单或进入复杂编辑器。

## Acceptance Criteria

1. **Given** 某个任务在处理过程中识别出需要人工处理的低置信度片段  
   **When** 系统将该任务切换到需要人工确认的状态  
   **Then** 任务必须进入明确的等待人工处理状态  
   **And** 该状态必须与普通失败或普通处理中清楚区分
2. **Given** 创作者打开处于等待人工确认状态的任务  
   **When** 页面加载该任务的 review 内容  
   **Then** 创作者必须能看到所有待确认的低置信度片段列表  
   **And** 每个片段都必须附带足够的上下文以支持判断
3. **Given** 某个低置信度片段需要被确认  
   **When** 创作者查看该片段  
   **Then** 页面必须提供对该片段的确认或处理入口  
   **And** 这些操作应聚焦在完成当前片段判断，而不是把创作者拉进重编辑器式流程
4. **Given** 创作者完成一个或多个低置信度片段的确认  
   **When** 创作者提交确认结果  
   **Then** 系统必须保存该人工确认记录  
   **And** 这些记录必须能与具体任务和对应片段关联
5. **Given** 当前任务的待确认片段都已被处理  
   **When** 系统确认 review 条件已满足  
   **Then** 任务必须能够继续推进后续处理链路  
   **And** 创作者不需要重新创建任务或从头执行之前已完成的处理阶段
6. **Given** 某个任务不存在低置信度片段  
   **When** 创作者查看该任务  
   **Then** 系统不得错误地要求人工确认  
   **And** 低置信度确认必须只在真正需要的场景下出现
7. **Given** 创作者通过桌面端或后续支持的移动端进入确认流程  
   **When** 页面展示待确认片段和动作入口  
   **Then** 关键状态、上下文和确认动作必须具备清晰可达的交互与语义表达  
   **And** 不得依赖纯颜色或隐晦图标来传达当前需要用户处理的内容
8. **Given** 创作者提交确认结果失败或校验未通过  
   **When** 页面返回错误  
   **Then** 当前 review 列表、上下文和已填写输入必须被保留  
   **And** 创作者可以修正后继续，而不需要重新获取任务或丢失当前判断

## Tasks / Subtasks

- [x] 基于 3.0 contract 落地 review 数据读取与任务状态投影 (AC: 1, 2, 6)
  - [x] 为 awaiting review 任务提供正式的 review queue 数据结构
  - [x] 让任务详情/列表稳定区分 review、processing 与 failed
- [x] 在工作台任务详情中渲染低置信度 review 队列 (AC: 2, 3, 7)
  - [x] 展示片段列表、上下文与当前确认状态
  - [x] 为每个片段提供聚焦式确认入口，而不是扩展成复杂编辑器
- [x] 提交 review 决策并记录审计事件 (AC: 4, 5, 8)
  - [x] 保存片段级确认记录与对应 task event
  - [x] 当全部 review 项完成时触发继续处理或重新入队
  - [x] 提交失败时保留当前 review 上下文
- [x] 补齐可访问性与回归测试 (AC: 1, 5, 6, 7, 8)
  - [x] 覆盖 review 队列展示、提交成功、提交失败保留上下文、无 review 场景
  - [x] 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 本 story 只交付“待确认片段查看 + 提交判断 + 继续当前任务”的最小可用 review 流程。
- 不引入通用字幕编辑器，也不在这里做失败解释或 support 专用诊断。

### Dependencies

- 依赖 Story 3.0 提供统一 review contract、事件命名和最小字段。
- 后续 Story 3.3 会消费这里产出的人工确认记录和时间线事件。

### Current Codebase State

- `task-status.server.ts` 已有 `awaiting_human_review` 状态与阶段时间线。
- `task-query.server.ts` 目前只暴露通用事件账本，尚未提供 review item 明细。
- `WorkspaceShell.tsx` 与任务详情组件已经能承载状态摘要和详情区块，可在现有页面内补充 review 卡片。

### Testing Requirements

- 优先扩展 `tests/task-query.test.ts`、`tests/workspace-view.test.ts`、`tests/workspace-shell.test.ts`。
- 回归必须锁定“失败提交后上下文仍保留”的 Epic 2 经验教训。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 73 tests.
- `pnpm build` passed.

### Completion Notes

- Added a formal low-confidence review queue read model derived from Epic 3 contract events.
- Rendered creator-facing review cards with snippet context, focused decision inputs, and request-scoped inline error/success feedback.
- Review submission now transitions the task from `awaiting_human_review` to `queued` through `task.review_resolved`, preserving creator context on failure.

### File List

- `_bmad-output/implementation-artifacts/3-1-low-confidence-review-queue-for-creators.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/tasks/components/TaskDetailPanel.tsx`
- `app/features/tasks/components/TaskReviewQueueCard.tsx`
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

- Review queue data和 UI 现在都基于共享 contract，不再依赖局部临时态。
- 提交失败会保留当前 review 列表和用户输入所在页面，不会把创作者踢回导入流。
- review 提交成功后会产生日志化的 `task.review_resolved` 事件并驱动状态继续推进。

Decision:

- Approve。Story 3.1 已满足最小 review queue、上下文保留和继续推进要求。

### Change Log

- 2026-06-08: Story artifact created from Epic 3 / Story 3.1 context.
- 2026-06-08: Implemented low-confidence review queue, creator review submission flow, and regression coverage.
- 2026-06-08: BMAD code review completed with approval.
