# Story 6.2: Minimum Audit Record and Queryable Task History

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
  - [x] 新增显式 support/ops 可访问的 route 或等价 loader，例如 `app/routes/tasks.$taskId.audit.tsx`、`app/routes/support.tasks.$taskId.audit.tsx`，或在现有 support detail 模式上增加独立 audit 面板
  - [x] 审计入口必须通过统一授权服务集中校验 `support`、`ops`、`admin`，不得在 route 内散落多套角色判断
  - [x] 若选择复用现有 support task detail 路径，必须保持“support 诊断视图”和“可查询最小审计记录”语义分层，避免把 6.2 写成 3.3 的页面 copy

- [x] 在 server 层组装最小审计记录 read model，复用既有真源而不是发明新存储 (AC: 1, 2, 3, 4, 6)
  - [x] 以 `tasks`、`task_events`、`audit_logs`、deliverable 访问审计为主真源，生成单个 `TaskAuditRecordView`
  - [x] `tasks` 负责任务基础事实：`taskId`、`sourceIdentifier`、`presetSnapshot.status`、`presetSnapshot.summary`、当前状态、创建时间
  - [x] `task_events` 负责生命周期轨迹：状态流转、预设决策、人工确认、失败、retry、人工介入
  - [x] `audit_logs` 负责高敏感动作与访问审计，尤其是授权拒绝、结果访问、后台读取等安全/运营侧行为
  - [x] 不要引入“审计专用状态表”作为第二真源；第一版应先把已有表投影成稳定的查询模型

- [x] 明确定义最小审计记录字段边界，保证实现不会缺项或过度扩 scope (AC: 2, 3, 6)
  - [x] 顶层摘要至少包含：`taskId`、`originTaskId`/attempt 信息、来源标识、预设路径标签、当前状态、最近 request_id、创建/更新时间
  - [x] 失败/中断摘要至少包含：失败阶段、`reasonCode`、可读说明、`diagnosticTraceId` 或等价追踪字段、是否可重试
  - [x] review 摘要至少包含：reviewId、待确认项数量、已确认结果、确认时间、确认 actor 或 system
  - [x] 人工覆盖/人工介入摘要至少包含：动作类型、作用对象、发生时间、actor id 或 system、关键上下文
  - [x] 审计历史项至少包含：事件类型、可读标签、task id、timestamp、actor id 或 system、request_id、前后状态差异或等价补充信息

- [x] 把 AC 中要求的关键事件标准化成统一时间线，避免 support/ops 各自发明文案 (AC: 3, 6)
  - [x] 至少保证以下可读事件存在或可被归并生成：`task.created`、预设已应用/已决策、状态变化、`task.retry_requested` / `task.retry_spawned`、交付物访问
  - [x] 对于“preset applied”若底层没有单独 event type，可由 `presetSnapshot.status` 与相关事件组合投影出审计条目，但必须在代码中集中实现
  - [x] 对于“delivery accessed”若当前下载链路尚未写独立 task event，应优先从 `audit_logs` 投影，而不是遗漏该类事件
  - [x] 时间线文案必须面向 support/ops 可读语义，不可直接把原始 eventType 当最终 UI 主文案

- [x] 处理 attempt lineage 与 30 天保留窗口语义，确保排障链不断裂 (AC: 2, 3, 4)
  - [x] 复用现有 `sourceSnapshot.attempt` 结构，明确展示 `originTaskId`、`retryOfTaskId`、`attemptNumber`
  - [x] 当任务是恢复 attempt 时，审计视图必须能解释“这次是从哪次失败恢复而来”
  - [x] 如果 retention 窗口内只有部分历史可见，页面必须显式说明“当前仅展示保留窗口内记录”，而不是假装历史完整
  - [x] 若某些事件缺失，必须以“暂无该类记录”或“当前样本不完整”表达，不能静默吞掉导致误判

- [x] 复用既有任务查询/诊断代码，但把共用逻辑抽回明确的审计投影层 (AC: 1, 2, 3, 6)
  - [x] 优先复用 `app/features/tasks/server/task-query.server.ts` 的 task/event 读取能力
  - [x] 优先复用 `app/features/tasks/server/task-diagnostics.server.ts` 的 failure/review/attempt 提取逻辑
  - [x] 若 3.3 和 6.2 共享大量 timeline 投影逻辑，应新增明确的 audit/query 模块，例如 `app/features/tasks/server/task-audit.server.ts`
  - [x] 不要把 6.2 的逻辑直接堆进 route 组件，也不要把 ops/support 专属 helper 扔进 `shared/`

- [x] 渲染结构化、可读的最小审计界面，先解释再给上下文 (AC: 1, 5, 6)
  - [x] 页面或面板应至少分成：任务摘要、失败/恢复摘要、review 与人工操作摘要、生命周期时间线、访问/下载审计
  - [x] 继续沿用现有 shell/card/status/timeline 视觉语言，避免为 6.2 引入新 UI 框架或复杂图表
  - [x] 界面必须明确显示 task ID、request_id、时间、actor/system，便于 support/ops 直接复制排障
  - [x] 空态、缺项和越权错误必须是内联解释，不得把核心解释责任丢给 toast

- [x] 补齐审计查询、授权和事件投影回归测试 (AC: 1, 2, 3, 4, 5, 6)
  - [x] 新增 server 层测试，覆盖最小字段集合、attempt lineage、failure/review 摘要、delivery access 审计投影
  - [x] 新增授权测试，覆盖 `support` / `ops` / `admin` 可读，`creator` 或未授权角色被拒绝
  - [x] 新增 route/UI 结构测试，锁定 task ID 查询入口、关键分区标题、request_id 展示和“暂无足够数据”类文案
  - [x] 对缺失 `audit_logs`、缺失 delivery access、缺失 review 决议等场景补回归，确保页面仍可解释
  - [x] 完成后至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 6.2 的目标不是再做一个大运营后台，而是把“单任务最小审计记录”正式产品化，让 support / ops / 排障角色不需要翻原始日志也能复盘。
- 与 6.1 的区别很明确：6.1 回答“系统整体表现怎样”，6.2 回答“这个任务具体发生过什么”。
- 与 3.3 的区别也要保持清楚：3.3 偏 support 诊断解释；6.2 要额外补齐最小审计字段边界、交付物访问审计、可稳定查询的 task-level record。

### Business and Epic Context

- Epic 6 的业务目标是把“可运营、可支持、可排障”从隐含能力变成显式能力。FR50 直接要求最小审计记录至少覆盖任务 ID、来源标识、预设命中/未命中结果、状态时间戳、人工覆盖、人工确认和失败/中断原因。
- `epics.md` 已把 6.2 的使用对象扩大到“运营、支持或排障角色”，因此实现不能只服务 support 单角色视图。
- 这个 story 是第一阶段保留窗口、恢复链路和安全排查闭环的关键承接点，后续 code review 会重点看它是否真的能减少查日志需求。

### Dependencies and Boundaries

- 强依赖既有数据与权限能力：
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/tasks/server/task-status.server.ts`
  - `app/features/auth/server/authz.server.ts`
  - `app/features/auth/server/audit.server.ts`
  - `database/schema/tasks.ts`
  - `database/schema/task-events.ts`
  - `database/schema/auth.ts`
- 与已完成 story 的关系：
  - `3-3-support-timeline-and-diagnostic-context.md` 提供 support-only timeline 模式与 failure/review 聚合经验
  - `6-1-operations-visibility-dashboard-for-preset-reuse-and-task-flow.md` 提供 ops/admin 授权入口与运营域模块边界
  - `1-7-completed-deliverables-and-secure-result-access.md` 对交付物访问控制与受控下载链路有约束，6.2 需要把访问审计补入可查询视图
- 明确不在本 story 完成：
  - 完整 BI 导出、批量审计搜索、跨任务高级查询
  - 新的长期归档系统或 retention 基础设施重构
  - 第二套独立任务状态模型

### Current Codebase State

- 当前已有两块可直接复用的事实来源：
  - `tasks` 表保存 `sourceIdentifier`、`presetSnapshot`、当前 `status`、创建/更新时间和 attempt 所需 `sourceSnapshot`
  - `task_events` 表保存 `eventType`、`fromStatus`、`toStatus`、`reasonCode`、`requestId`、`actorUserId`、`payload`、`createdAt`
- `task-query.server.ts` 已经能：
  - 读取单任务详情与事件账本
  - 生成 creator 详情视图和 support 详情视图
  - 复用 `getTaskAttemptSnapshot()`、`extractReviewQueue()`、`extractFailureContext()`
- `task-diagnostics.server.ts` 已经定义了：
  - review item / review decision 归一化
  - failure context 抽取
  - support diagnostic entry 投影
  - 这些逻辑适合被 6.2 继续复用或上提到更明确的 audit projection 层
- `authz.server.ts` 已存在 `requireRole()` 与 `requireAnyRole()`，6.1 已实际用 `requireAnyRole(["ops", "admin"])` 跑通多角色授权路径
- `auth.ts` 里的 `auditLogs` 表已存在，但目前 story 文档和现有页面更多只在授权拒绝场景显式使用；6.2 应把它变成 task audit 视图的一等输入，而不是继续闲置
- `operations-dashboard.server.ts` 已证明 ops 侧做领域化 read model 是当前仓库接受的模式；6.2 可以沿用 `app/features/tasks/server/` 或新增小型 audit server 模块，而不需要再试探架构方向

### Data and Audit Modeling Guidance

- 最小审计记录建议拆成 5 个稳定区块：
  - `summary`: 任务基本事实、当前状态、预设路径、attempt lineage、最近 request_id
  - `timeline`: 生命周期与关键动作的统一可读时间线
  - `review`: 低置信度确认队列与已解决决策
  - `failure`: 失败/中断/恢复摘要
  - `access_audit`: 下载/高敏感读取/拒绝访问等安全与运营相关动作
- 事件映射建议：
  - `task.created` -> 任务已创建
  - `task.preset_decision_requested` + `presetSnapshot.status` -> 等待预设决策 / 预设已应用路径
  - 任意 `fromStatus -> toStatus` 关键变化 -> 状态已变更
  - `task.retry_requested` / `task.retry_spawned` -> 恢复重试链路
  - `task.review_required` / `task.human_review_requested` / `task.review_resolved` -> 人工确认链路
  - `audit_logs` 中与 deliverable/download/task read 相关事件 -> 交付物访问或敏感读取审计
- “preset applied” 是 AC 指定语义，不一定要求数据库必须先有一个同名 event；如果当前真实实现只有 snapshot 或决策事件，允许通过投影层生成统一审计条目，但生成规则必须单点定义并有测试。
- “delivery accessed” 不能只存在下载 route 的临时日志里；如果现有下载链路尚未产生日志，这个 story 很可能需要顺手补一个正式 `audit_logs` 写入点。

### Architecture Compliance

- 必须继续遵守“后端状态模型是唯一真源”，不能为审计页面再发明第二套状态字符串。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守 Yakimoji API / 页面错误展示里的 `request_id` 可追踪要求；最小审计视图应把它当一等字段，而不是埋在 payload 里。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守本地 RBAC 是唯一授权真源；`support` / `ops` / `admin` 的访问权都应来自本地角色，不得直接读取上游 SSO role 作为资源授权判断。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守 domain-first 结构；新增审计聚合代码优先留在 `app/features/tasks/server/` 或专门的审计域模块，不要丢进 `shared/utils`。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守“高敏感动作可追踪到谁、对哪个 task、在什么时间做了什么”；6.2 实现不应只读已有数据，也要检查缺失的关键写审计点。[Source: `_bmad-output/planning-artifacts/architecture.md`]

### UX and Interaction Guardrails

- 审计页面是“解释台”不是“日志墙”。默认应该先给出任务摘要和关键结论，再给时间线与明细。
- 重要字段优先级应是：task ID、当前状态、预设路径、失败/恢复结论、request_id、时间线、review/人工操作、访问审计。
- 文案必须继续遵循“先解释，后行动”的模式。尤其在失败或历史不完整时，要先说明现状，再说明缺了什么。
- 不要把 UI 做成 raw JSON viewer；第一版需要结构化卡片/列表/时间线。
- 空数据表达要清楚区分：
  - 当前没有这类事件
  - 当前只有部分历史
  - 当前无权查看

### File Structure Requirements

- 优先新增或修改：
  - `app/features/tasks/server/task-audit.server.ts` 或等价审计投影模块
  - `app/routes/tasks.$taskId.audit.tsx`、`app/routes/support.tasks.$taskId.audit.tsx` 或现有 support route 的独立 audit 模式
  - `app/features/tasks/components/TaskAuditRecordCard.tsx`
  - `app/features/tasks/components/TaskAuditTimeline.tsx`
  - `app/features/tasks/components/TaskAuditAccessLogList.tsx`
  - `app/features/auth/server/audit.server.ts`（若需补齐下载/访问审计写入点）
  - `tests/task-audit.test.ts`
  - `tests/task-audit-route.test.ts`
  - `tests/task-query.test.ts` 或 `tests/workspace-view.test.ts` 的扩展覆盖
- 可复用但要谨慎：
  - `app/shared/ui/WorkspaceShell.tsx`
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/operations/server/operations-dashboard.server.ts`
- 不要新增：
  - 第二套任务事件 schema
  - 大型日志检索 SDK
  - 与现有 route loader 模式冲突的前端自管数据层

### Testing Requirements

- 必须覆盖：
  - 未授权角色读取 audit 视图被拒绝
  - `support` / `ops` / `admin` 能读取同一 task 的最小审计记录
  - 最小字段集合不会缺：task ID、sourceIdentifier、preset path、status timestamps、review、manual intervention、failure reason
  - 生命周期时间线至少包含 created / status changed / retry / delivery access 等关键语义
  - attempt lineage 能正确显示 origin/retry 关系
  - delivery access 若来自 `audit_logs`，其映射不会因缺少 `task_events` 而丢失
  - 缺失部分历史或 retention 受限时，页面仍给出清晰解释
- 优先扩展或新增：
  - `tests/task-query.test.ts`
  - `tests/workspace-view.test.ts`
  - 新增 `tests/task-audit.test.ts`
  - 新增 `tests/task-audit-route.test.ts`
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### Previous Story Intelligence

- 6.1 已经证明：
  - `ops/admin` 多角色授权路径可以通过 `requireAnyRole()` 集中实现
  - 运营/内部视图应新建独立 read model，而不是强行复用 creator-only 工作台
  - 指标与下钻口径必须一致，否则后续 review 会直接打回
- 对 6.2 的直接启发：
  - 读模型字段命名和 UI 口径要从一开始统一，避免“摘要和明细对不上”
  - 分页、空数据与越界状态要在 server 层一次性处理好
  - 不要用“先拉全量、前端再筛”的方式做 task-level audit 之外的聚合读取

### Git Intelligence Summary

- 最近与当前 epic 最相关的提交是 `009f9ee feat: add operations visibility dashboard`，它新增了 `app/features/operations/server/operations-dashboard.server.ts`、独立 route、授权复用和读模型测试。
- 这说明仓库当前实现风格偏向：
  - 通过 route loader + server read model 交付内部视图
  - 通过集中授权 helper 管控多角色访问
  - 通过 Node test 锁定文案、聚合口径与路由清单
- 6.2 应沿这条路径增量扩展，而不是回退成 route 内直接拼 SQL / 拼 UI 状态。

### Latest Technical Information

- 截至 **2026-06-14**，React Router 官方 `Actions` 文档的当前版本显示为 **7.17.0**，并继续强调数据写入通过 route `action` 完成，且 action 完成后页面 loader 数据会自动 revalidate；因此如果 6.2 需要补“标记已查看”“复制 task ID 后的轻量动作”之类交互，优先沿用 route action / loader 一致模型，不要旁路出一套手写同步逻辑。[Official: `https://reactrouter.com/start/framework/actions`]
- 截至 **2026-06-14**，React Router 官方 `useFetcher` 文档仍明确它适合“不会引发导航的并发数据交互”；因此若 6.2 在 audit 页面加入局部刷新、折叠明细或轻量筛选，可优先使用 `fetcher`，而不是引入额外全局状态容器。[Official: `https://reactrouter.com/api/hooks/useFetcher`]
- 截至 **2026-06-14**，TanStack Query 官方文档仍把 `invalidateQueries` 描述为已知数据过期后的核心同步方式，主张 targeted invalidation + background refetch，而不是手工维护 normalized cache；如果 6.2 复用现有 query 层做局部刷新，应保持“服务端真源 + 定向失效”模式。[Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]
- 截至 **2026-06-14**，Drizzle 官方文档继续把索引与约束视为 schema 层正式能力；如果 6.2 为 `audit_logs` 或 task audit 查询补索引，应通过 Drizzle schema + migration 明确落地，而不是只在线上库临时手改。[Official: `https://orm.drizzle.team/docs/indexes-constraints`]

### Project Context Reference

- workflow `persistent_facts` 指向的 `project-context.md` 全仓扫描未找到匹配文件。
- 当前有效项目上下文来自：
  - `AGENTS.md`
  - `_bmad-output/planning-artifacts/epics.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
  - `_bmad-output/implementation-artifacts/6-1-operations-visibility-dashboard-for-preset-reuse-and-task-flow.md`
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/operations/server/operations-dashboard.server.ts`
  - `app/features/auth/server/authz.server.ts`
  - `database/schema/tasks.ts`
  - `database/schema/task-events.ts`
  - `database/schema/auth.ts`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-6.2-Minimum-Audit-Record-and-Queryable-Task-History`]
- [Source: `_bmad-output/planning-artifacts/architecture.md`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]
- [Source: `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`]
- [Source: `_bmad-output/implementation-artifacts/6-1-operations-visibility-dashboard-for-preset-reuse-and-task-flow.md`]
- [Source: `app/features/tasks/server/task-query.server.ts`]
- [Source: `app/features/tasks/server/task-diagnostics.server.ts`]
- [Source: `app/features/operations/server/operations-dashboard.server.ts`]
- [Source: `app/features/auth/server/authz.server.ts`]
- [Source: `database/schema/tasks.ts`]
- [Source: `database/schema/task-events.ts`]
- [Source: `database/schema/auth.ts`]
- [Source: `tests/operations-dashboard.test.ts`]
- [Source: `tests/operations-route.test.ts`]
- [Official: `https://reactrouter.com/start/framework/actions`]
- [Official: `https://reactrouter.com/api/hooks/useFetcher`]
- [Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]
- [Official: `https://orm.drizzle.team/docs/indexes-constraints`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- create-story workflow executed manually with customization fallback because local `python3` lacks stdlib `tomllib`
- story target auto-discovered from `_bmad-output/implementation-artifacts/sprint-status.yaml` as first backlog item: `6-2-minimum-audit-record-and-queryable-task-history`
- latest official docs checked on 2026-06-14 for React Router, TanStack Query, and Drizzle implementation guardrails
- dev-story implementation added dedicated task audit route/read model and verified with `pnpm test`, `pnpm typecheck`, and `pnpm build`

### Completion Notes List

- Created a comprehensive implementation-ready story artifact for 6.2 with task-level audit scope, read-model guidance, authorization boundaries, and test requirements
- Anchored the story on existing `tasks`, `task_events`, `audit_logs`, support diagnostics, and 6.1 ops read-model patterns to prevent reinvention
- Explicitly separated 6.2 from 3.3 support diagnostics and 6.1 aggregate operations analytics so the next dev agent has clear scope boundaries
- Implemented `/tasks/:taskId/audit` as a support/ops/admin-only audit entry separated from creator workspace and 6.1 operations dashboard.
- Added `TaskAuditRecordView` projection over `tasks`, `task_events`, and `audit_logs`, including attempt lineage, failure/review/manual summaries, unified timeline, delivery access audit, and 30-day retention copy.
- Added structured audit UI and regression coverage for route registration, authorization, minimum fields, delivery access projection, failure/review summaries, and retention messaging.

### File List

- `_bmad-output/implementation-artifacts/6-2-minimum-audit-record-and-queryable-task-history.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/features/tasks/components/TaskAuditScreen.tsx`
- `app/features/tasks/server/task-audit.server.ts`
- `app/routes.ts`
- `app/routes/tasks.$taskId.audit.tsx`
- `tests/task-audit-route.test.ts`
- `tests/task-audit.test.ts`
- `tsconfig.vite.tsbuildinfo`

## Change Log

- 2026-06-14: created story artifact from Epic 6 / Story 6.2 context with manual customization fallback and updated sprint status to `ready-for-dev`
- 2026-06-14: implemented minimum task audit record route, read model, UI, authorization, and regression coverage; story moved to `review`

### Review Findings

- [x] [Review][Patch] 保留窗口状态始终显示为完整历史，无法兑现 AC4 的“部分历史显式说明”承诺 [app/features/tasks/server/task-audit.server.ts:522]
- [x] [Review][Patch] 访问审计只展示交付物下载，遗漏授权拒绝和任务读取等高敏感动作，与 story 的 access audit 边界不一致 [app/features/tasks/server/task-audit.server.ts:310]
- [x] [Review][Patch] 时间线首条标签和人工操作分类不符合 story 规定的可读审计语义，且缺少对应回归测试保护 [app/features/tasks/server/task-audit.server.ts:233]
