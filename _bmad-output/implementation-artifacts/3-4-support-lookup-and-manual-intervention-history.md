# Story 3.4: Support Lookup and Manual-intervention History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 支持人员,
I want 基于任务 ID 查看人工覆盖与人工确认记录,
so that 我能解释用户做过哪些人工操作并辅助后续排障。

## Acceptance Criteria

1. **Given** 支持人员需要基于任务 ID 排查问题  
   **When** 支持人员搜索或打开该任务  
   **Then** 系统必须能基于任务 ID 读取相关状态与审计信息  
   **And** 这些记录至少满足系统已承诺保留的时间窗口
2. **Given** 某个任务经历过人工覆盖或低置信度人工确认  
   **When** 支持人员查看该任务诊断信息  
   **Then** 系统必须能够展示相关人工操作记录  
   **And** 至少包括操作类型、对应任务上下文和发生时间
3. **Given** 授权支持人员查看人工操作记录  
   **When** 页面或接口展示这些内容  
   **Then** 记录必须以结构化、可读的方式呈现  
   **And** 不得要求支持人员直接解析底层原始日志才能理解发生过什么

## Tasks / Subtasks

- [x] 建立 support 侧按 task ID 打开人工操作历史的独立入口 (AC: 1, 3)
  - [x] 新增独立 support route / loader，避免把 3.4 混入 creator workspace 或 6.3 审计总览
  - [x] 统一复用 `support` / `ops` / `admin` 角色校验
- [x] 组装人工确认与人工介入历史 read model (AC: 1, 2, 3)
  - [x] 基于 `task_events` 提取 review_required / review_resolved / manual_intervention 关联上下文
  - [x] 记录至少包含操作类型、任务上下文、发生时间、request_id 与 actor/system
  - [x] 明确保留窗口提示，避免把历史不完整伪装成完整记录
- [x] 渲染结构化 support history 视图 (AC: 2, 3)
  - [x] 明确展示 task ID、attempt lineage、人工确认摘要和人工介入时间线
  - [x] 保持与 3.3 support diagnostics 的视觉语言一致，但不混入 6.3 access audit / deliverable 审计语义
- [x] 补齐回归测试并完成验证 (AC: 1, 2, 3)
  - [x] 覆盖授权访问、越权拒绝、manual/review history 投影与 route 注册
  - [x] 运行 `pnpm typecheck`、`pnpm test`

## Dev Notes

### Story Intent

- 本 story 只交付 support 侧基于 task ID 的人工确认与人工介入历史，不扩展到 6.3 的最小审计记录总览。
- 与 3.3 的区别：3.3 解释失败、未命中与诊断上下文；3.4 聚焦“人做过什么”。

### Dependencies

- 复用 `app/features/tasks/server/task-query.server.ts` 的 task / event 查询能力。
- 复用 `app/features/tasks/server/task-diagnostics.server.ts` 的 review、attempt、failure 归一化逻辑。
- 继续沿用 `requireAnyRole(["support", "ops", "admin"])` 作为支持侧授权边界。

### Current Codebase State

- `support/tasks/:taskId/diagnostics` 已提供 3.3 的 support-only 诊断页。
- `tasks/:taskId/audit` 已承载 6.3 的最小审计记录与访问审计，不应直接作为 3.4 页面复用。
- `task.review_required`、`task.review_resolved`、`task.manual_intervention` 事件已经存在，可直接投影成人工历史。

### Testing Requirements

- 验证 support / ops / admin 可读，creator-only 会被拒绝。
- 验证页面可按 task ID 展示人工确认和人工介入记录。
- 验证结构化字段至少包含操作类型、上下文、时间、request_id。

## Dev Agent Record

### Debug Log

- 2026-06-20: Story artifact recreated because the previous implementation path mixed 3.4 scope with 6.3 audit scope.
- 2026-06-20: `pnpm typecheck` passed.
- 2026-06-20: `pnpm test` passed with 133 tests.
- 2026-06-20: `pnpm build` passed.

### Completion Notes

- Added a dedicated support history route at `/support/tasks/:taskId/history` so support can open manual history directly by task ID.
- Extended the support diagnostic read model with structured manual history entries covering review requested, review resolved, and manual intervention events.
- Added a support history card that shows task context, actor, request_id, and retention caveats without mixing in the 6.3 access-audit surface.

### File List

- `_bmad-output/implementation-artifacts/3-4-support-lookup-and-manual-intervention-history.md`
- `app/features/tasks/components/TaskSupportDiagnosticScreen.tsx`
- `app/features/tasks/components/TaskSupportHistoryCard.tsx`
- `app/features/tasks/server/task-query.server.ts`
- `app/routes.ts`
- `app/routes/support.tasks.$taskId.history.tsx`
- `tests/support-diagnostics-route.test.ts`
- `tests/task-query.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-20

Findings:

- Support history is now scoped to human actions only, so 3.4 no longer bleeds retry or 6.3 access-audit semantics into the page contract.
- The new route and read model keep support access behind the shared internal-role authorization boundary.
- The rendered history entries now expose task context, actor and request_id in a structured support-readable shape.

Decision:

- Approve。Story 3.4 现已满足按 task ID 查看人工确认与人工介入历史的范围要求。

### Change Log

- 2026-06-20: Story artifact recreated from Epic 3 / Story 3.4 context.
- 2026-06-20: Implemented dedicated support manual-history route, structured history projection, and regression coverage.
- 2026-06-20: BMAD code review completed with approval.
