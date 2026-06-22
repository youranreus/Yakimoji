# Story 6.3: Minimum Audit Record and Queryable Task History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 运营、支持或排障角色,
I want 按任务 ID 查询最小审计记录和关键生命周期历史,
so that 我能复盘任务发生过什么并支撑解释、排障与恢复。

## Acceptance Criteria

1. **Given** 系统中存在已创建或已处理过的任务  
   **When** 运营、支持或排障角色按任务 ID 查询任务记录  
   **Then** 系统必须能够返回该任务的最小审计记录  
   **And** 该记录必须可供授权角色稳定读取，而不是只存在临时运行日志中
2. **Given** 某个任务存在完整或部分生命周期数据  
   **When** 系统返回该任务的最小审计记录  
   **Then** 记录至少必须包含任务 ID、来源标识、命中的频道预设或未命中结果、任务状态流转时间戳、人工覆盖记录、人工确认记录，以及失败或中断原因  
   **And** 这些字段必须满足第一阶段对最小审计能力的承诺边界
3. **Given** 某个任务经历过关键生命周期事件  
   **When** 授权角色查看该任务历史  
   **Then** 系统必须能够展示至少以下事件：task created、preset applied、status changed、retry triggered、delivery accessed  
   **And** 每条记录至少应关联 actor id 或 system、timestamp、task id，且对关键状态变化保留前后值或等价差异信息
4. **Given** 某个任务在 30 天保留窗口内发生过失败、中断或人工介入  
   **When** 授权角色查询该任务  
   **Then** 系统必须仍能返回对应状态与审计信息  
   **And** 不得因为前端缓存失效或处理完成而丢失关键排障证据
5. **Given** 非授权用户或越权内部角色尝试查询该任务的审计信息  
   **When** 系统执行访问控制  
   **Then** 系统必须拒绝该访问  
   **And** 不得因审计查询接口存在而放宽任务与诊断信息的授权边界
6. **Given** 授权角色读取某个任务的最小审计记录  
   **When** 页面或接口展示这些内容  
   **Then** 记录必须以结构化、可读的方式呈现  
   **And** 不得要求用户直接解析底层原始日志才能理解任务发生过什么

## Tasks / Subtasks

- [x] 建立 task ID 定位的最小审计查询入口，并与 creator workspace / ops dashboard 分离 (AC: 1, 5, 6)
  - [x] 新增显式 support/ops 可访问的 route 或等价 loader，例如 `app/routes/tasks.$taskId.audit.tsx`
  - [x] 审计入口必须通过统一授权服务集中校验 `support`、`ops`、`admin`
  - [x] 保持“support 诊断视图”和“可查询最小审计记录”语义分层，避免把 6.3 写成 3.3 页面 copy

- [x] 在 server 层组装最小审计记录 read model，复用既有真源而不是发明新存储 (AC: 1, 2, 3, 4, 6)
  - [x] 以 `tasks`、`task_events`、`audit_logs`、deliverable 访问审计为主真源，生成单个 `TaskAuditRecordView`
  - [x] 明确由 `tasks` 承担基础事实、`task_events` 承担生命周期轨迹、`audit_logs` 承担安全与访问审计
  - [x] 不引入“审计专用状态表”作为第二真源

- [x] 明确定义最小审计记录字段边界并统一时间线语义 (AC: 2, 3, 6)
  - [x] 摘要覆盖 task id、attempt lineage、来源标识、预设路径、当前状态、request_id、创建/更新时间
  - [x] failure/review/manual summaries 覆盖失败原因、人工确认、人工介入和关键上下文
  - [x] 时间线统一投影 created / preset applied / status changed / retry / delivery access 等关键语义

- [x] 处理 attempt lineage 与保留窗口提示，确保排障链不断裂 (AC: 2, 3, 4)
  - [x] 复用现有 `sourceSnapshot.attempt` 结构展示 `originTaskId`、`retryOfTaskId`、`attemptNumber`
  - [x] 历史缺失与 retention 限制必须显式提示，而不是假装完整

- [x] 渲染结构化、可读的最小审计界面 (AC: 1, 5, 6)
  - [x] 页面分成任务摘要、失败/恢复摘要、review 与人工操作摘要、生命周期时间线、访问/下载审计
  - [x] 继续沿用现有 shell/card/status/timeline 视觉语言，避免引入新 UI 框架或复杂图表

- [x] 补齐审计查询、授权和事件投影回归测试 (AC: 1, 2, 3, 4, 5, 6)
  - [x] 覆盖最小字段集合、attempt lineage、failure/review 摘要、delivery access 审计投影
  - [x] 覆盖 `support` / `ops` / `admin` 可读与 creator-only 拒绝
  - [x] 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 6.3 的目标不是做一个大运营后台，而是把“单任务最小审计记录”正式产品化。
- 与 6.1 的区别很明确：6.1 回答“系统整体表现怎样”，6.3 回答“这个任务具体发生过什么”。
- 与 3.3 的区别也要保持清楚：3.3 偏 support 诊断解释；6.3 要额外补齐最小审计字段边界、交付物访问审计和稳定可查询的 task-level record。

### Current Codebase State

- `tasks/:taskId/audit`、`app/features/tasks/server/task-audit.server.ts`、`tests/task-audit*.ts` 已承载该能力。
- 该实现曾因历史编号漂移误占 `6-2` 文件名，本次已纠正为 canonical `6.3`。
- 3.4 support history 与 6.1 operations KPI 已按边界拆分，不再与 6.3 混写。

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-14: implemented minimum task audit record route, read model, UI, authorization, and regression coverage
- 2026-06-22T14:39:14+0800: corrected the historical Epic 6 artifact numbering drift and moved this implementation artifact to canonical Story 6.3

### Completion Notes List

- Added `TaskAuditRecordView` projection over `tasks`, `task_events`, and `audit_logs`, including attempt lineage, failure/review/manual summaries, unified timeline, delivery access audit, and retention copy.
- Added a dedicated audit route and structured task audit screen for `support` / `ops` / `admin`.
- Synchronized BMAD artifact numbering so this completed audit implementation now belongs to Story 6.3.

### File List

- `_bmad-output/implementation-artifacts/6-3-minimum-audit-record-and-queryable-task-history.md`
- `app/features/tasks/components/TaskAuditScreen.tsx`
- `app/features/tasks/server/task-audit.server.ts`
- `app/routes/tasks.$taskId.audit.tsx`
- `tests/task-audit.test.ts`
- `tests/task-audit-route.test.ts`

### Change Log

- 2026-06-14: created and implemented the minimum audit record story
- 2026-06-22: corrected artifact numbering so the completed task audit implementation aligns with canonical Story 6.3
