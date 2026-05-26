# Story 1.5: Creator Task List and Detail Status Views

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在工作台中查看任务列表、当前状态和阶段时间线,
so that 我能理解任务进展而不用手动拼凑后台情况。

## Acceptance Criteria

1. **Given** 创作者进入任务列表或任务详情页  
   **When** 页面加载任务数据  
   **Then** 创作者必须能看到任务当前顶层状态、来源摘要和最近关键进展  
   **And** 任务详情页必须提供按时间顺序排列的阶段时间线或状态账本视图
2. **Given** 任务仍在处理中  
   **When** 创作者查看任务详情  
   **Then** 页面必须清楚区分当前正在处理、已完成阶段和最终尚未到达的阶段  
   **And** 不能仅显示模糊的“处理中”而没有阶段语义
3. **Given** 工作台存在历史任务列表  
   **When** 创作者浏览和分页切换任务  
   **Then** 任务列表必须支持分页并保持高频浏览性能目标  
   **And** 不得在列表页一次性加载完整事件历史导致工作台退化
4. **Given** 创作者通过键盘而非鼠标操作任务列表和详情  
   **When** 创作者导航列表、进入详情并阅读状态信息  
   **Then** 核心路径必须可通过键盘完成  
   **And** 状态、时间线与关键动作都必须具备清晰语义标签与非纯颜色表达

## Tasks / Subtasks

- [x] 把受保护工作台从“最近创建任务占位”演进为真实任务列表与详情入口 (AC: 1, 3, 4)
  - [x] 继续以 `app/routes/workspace.tsx` 作为受保护入口，保留 Story 1.3 的任务导入主行动区与登录态壳层
  - [x] 为列表与详情建立 route-driven 导航，不要把详情只做成无法直达、无法分享、无法刷新的组件内临时展开态
  - [x] 如新增任务详情路由，必须同步更新 `app/routes.ts`，并保持 `/workspace` 仍是创作者默认入口
  - [x] 列表/详情的加载态文案要表达“正在加载什么”，不要只显示无语义 spinner

- [x] 在 `features/tasks/server` 内补齐分页列表、详情读取与时间线查询帮助器 (AC: 1, 2, 3)
  - [x] 基于 `tasks + task_events` 提供 paginated list read model，返回顶层状态、来源摘要、最近关键进展与分页元数据
  - [x] 提供 task detail read model，至少包含任务摘要、当前顶层状态、最近关键进展、按时间顺序排列的事件账本
  - [x] 保持任务读取权限基于当前登录 creator 的本地 session / RBAC，只能看到自己的任务
  - [x] 不要把读取逻辑继续堆进 `task-intake.server.ts`；如需新增查询模块，放在 `app/features/tasks/server/` 领域内

- [x] 把统一状态契约映射为可读的阶段语义与 UI 文案，而不是发明第二套状态体系 (AC: 1, 2, 4)
  - [x] 继续以 `app/features/tasks/server/task-status.server.ts` 作为唯一顶层状态枚举真源
  - [x] 基于现有 `task_events` 和顶层状态构建“已完成 / 当前进行中 / 尚未到达 / 等待人工 / 失败终态”展示层映射
  - [x] 前端展示文案通过映射层生成，不要直接把原始枚举值裸露给用户
  - [x] 失败或异常状态需要同时展示阶段语义、可读说明和 `request_id` 或等价追踪信息

- [x] 按 UX 规范实现任务列表卡片、详情摘要和流程阶段时间线 / 状态账本 (AC: 1, 2, 4)
  - [x] 任务列表项至少展示任务标题或来源标题、来源摘要、当前状态、最近关键进展、创建时间或最近更新时间
  - [x] 任务详情页必须把“当前在哪一步、刚发生了什么、接下来会做什么”组织为清晰的信息层级
  - [x] 时间线默认聚焦关键阶段，异常时自动展开相关说明，而不是把所有技术细节无差别倾倒给用户
  - [x] 状态表达必须有文本、结构和必要图形辅助，但不能只依赖颜色或图标传达含义

- [x] 满足分页性能、键盘可达性和测试基线要求 (AC: 3, 4)
  - [x] 单页大小遵守架构与 NFR 上限，列表页不预取完整事件历史
  - [x] 核心路径支持键盘导航、可见焦点、语义标签和屏幕阅读器可理解的状态更新
  - [x] 为列表/详情 query helper、路由 loader、关键 UI 状态与鉴权边界补齐测试
  - [x] 保持 Story 1.3 / 1.4 的任务导入、生命周期、auth/session 和 workspace shell 测试继续通过

### Review Findings

- [x] [Review][Patch] Tracked patch references untracked workspace modules and is not self-contained [app/routes/workspace.tsx:5]
- [x] [Review][Patch] Failed or cancelled tasks fabricate a processing-stage timeline when the last active status is missing [app/features/tasks/server/task-status.server.ts:203]
- [x] [Review][Patch] Direct task detail errors collapse missing tasks into a misleading permission-denied response [app/features/tasks/server/task-query.server.ts:496]
- [x] [Review][Patch] Workspace detail coverage relies on source-string assertions instead of exercised route behavior [tests/e2e/workspace-shell.test.mjs:35]

## Dev Notes

### Story Intent

- Story 1.5 是 Epic 1 从“能提交任务”走向“能看懂任务”的关键故事，不是单纯把 `recentTasks` 扩大成更多列表项。
- 本 story 必须消费 Story 1.4 已建立的统一状态枚举和 `task_events` 账本，让任务列表与详情建立在同一真源之上。
- 本 story 的范围是列表、详情、阶段语义和时间线可见性，不包含 SSE 实时同步、review 处理、下载结果访问或失败恢复动作实现；这些分别留给 Story 1.6、3.x、1.7。

### Business and Epic Context

- Epic 1 的产品承诺是：创作者安全进入工作台，手动导入任务，看懂处理进度，并最终拿到首个可交付结果。
- Story 1.3 已经把“导入 -> 识别 -> 确认 -> 真实任务写入”跑通；Story 1.4 已把任务生命周期提升为 `tasks + task_events` 的统一真源。
- Story 1.5 负责把这套真源第一次暴露成可信的创作者界面。如果这里仍然只展示模糊“处理中”或列表不支持分页，Epic 1 的“任务透明度”价值就还没有成立。

### Previous Story Intelligence

- Story 1.4 已明确：顶层任务状态只能来自 `app/features/tasks/server/task-status.server.ts`，`task_events` 用来承载更细粒度阶段与事件说明。
- `getTaskLifecycleSnapshot` 当前只返回单任务摘要和最新事件，足够支撑“最近关键进展”，但不足以直接满足“按时间顺序的完整账本”需求；Story 1.5 需要在此基础上补读模型，而不是绕开它重新造状态。
- Story 1.3/1.4 都强调 `request_id`、server-only helper、结构化错误和 route-first 集成；本 story 必须沿用相同组织方式，不能把列表/详情逻辑散落进 `shared/` 或组件私有状态。

### Git Intelligence Summary

- 最近三次相关提交表明当前仓库的有效模式是：`route loader/action` 承载入口，领域逻辑收敛到 `app/features/*/server`，测试覆盖围绕 server helper 和 route shell 展开。
- `c261726 feat: implement story 1.3 task intake preview` 把工作台壳层推进为任务导入主行动区，说明 `WorkspaceShell` 目前承担了较多过渡性 UI 责任。
- `b596b9a fix: harden task intake review follow-ups` 与 `e6bd80c Fix task lifecycle review findings` 进一步说明：该仓库偏向“先形成明确领域边界，再用测试和小修补收敛回归”，不接受在 route JSX 内部散写业务逻辑。

### Architecture Compliance

- 前端仍需遵循 React Router Framework Mode 的 route-driven 模式：首屏 bootstrap 数据优先走 `loader`，高频局部刷新再考虑选择性 Query Cache，而不是一开始把所有服务器状态统一塞进客户端全局缓存。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Frontend Architecture`]
- `TanStack Query v5` 在架构中是为“任务列表 / 单任务详情 / 任务事件流 / 交付物状态摘要”的细粒度缓存和失效预留的，不是替代 route loader 的唯一数据层；如果本 story 尚未真正引入它，也必须保留后续可无痛接入的读取边界。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#State Management Approach`]
- 任务列表必须分页，任务事件流按需加载，列表页不得预取完整事件历史；这是明确写死的性能规则，不是可选优化。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Performance and Bundle Strategy`]
- API/内部数据格式继续遵守：数据库 `snake_case`、应用层/API `camelCase`、分页集合统一 `{ data, meta.pagination }` 结构；不要在 story 1.5 里引入新的列表响应花样。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Format Patterns`]
- 任何 route、service、component、未来的 SSE handler 都不得发明第二套状态字符串；前端展示文案必须通过映射层从统一枚举派生。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#High-Risk Divergence Pre-Mortem`]

### UX and Interaction Guardrails

- UX 文档把“流程阶段时间线 / 状态账本”定义为任务详情主模块，强调信息组织顺序必须回答三个问题：当前在哪一步、发生了什么、下一步是什么。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#流程阶段时间线--状态账本`]
- “运行中状态卡”是列表页和详情摘要区的核心对象，必须优先展示对判断有帮助的信息，而不是堆低价值字段。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#运行中状态卡`]
- 所有关键状态都必须“关键状态内联，轻量反馈补充”；不要把列表/详情中的真实状态信息藏到 toast 里。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns`]
- 列表进入详情、详情返回列表必须低跳跃、可逆、可分享；不要做成只能在当前页面里暂时展开的不可直达状态。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Navigation Patterns`]
- 桌面端应保留较高信息密度与并列结构；移动端只压缩信息密度，不改变状态逻辑。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Responsive Strategy`]

### Current Codebase State and Files to Update

- `app/routes/workspace.tsx`
  - 当前状态：受保护的 creator 工作台入口，loader 返回 `recentTasks`、登录态、壳层导航和 support panels；action 仍承接 Story 1.3 的任务导入。
  - 本 story 要改：扩展为任务列表 bootstrap 数据入口，并在不破坏导入闭环的前提下提供详情导航能力。
  - 必须保留：`requireUserSession`、`requireRole`、`requestId`、当前工作台入口路径与 logout 流程。

- `app/shared/ui/WorkspaceShell.tsx`
  - 当前状态：一个较大的过渡型壳层组件，既承载 hero / nav / intake，也渲染“最近创建任务”列表。
  - 本 story 要改：把任务列表、详情摘要、状态账本等任务域 UI 从通用壳层中拆分出去，改由 `features/tasks` 领域组件组合进来。
  - 必须保留：现有任务导入入口、登录态卡片、安全边界与 request_id 呈现意图。

- `app/features/tasks/server/task-intake.server.ts`
  - 当前状态：负责导入预览/确认，并提供 `listRecentTasksForUser` 仅返回最近 5 条任务摘要。
  - 本 story 要改：不要继续在这里膨胀读取模型；可保留 `listRecentTasksForUser` 供壳层摘要使用，但分页列表与详情查询应迁出到更明确的 read-model helper。
  - 必须保留：任务导入 action、确认落库逻辑、当前任务摘要字段含义。

- `app/features/tasks/server/task-events.server.ts`
  - 当前状态：可追加事件、状态迁移、读取单任务 `getTaskLifecycleSnapshot`，只取 `latestEvent`。
  - 本 story 要改：补充按时间顺序读取事件账本的 helper，以及能为详情视图提供阶段时间线数据的读取边界。
  - 必须保留：状态迁移 helper、终态 reason code 校验、`request_id` 与事件写入一致性。

- `app/features/tasks/server/task-status.server.ts`
  - 当前状态：定义唯一顶层状态枚举与允许的状态转移。
  - 本 story 要改：可新增 UI 友好的 label / stage mapping helper，但不能修改既有公开状态字符串语义，也不能把 stage helper 和状态真源分裂到多个文件里。
  - 必须保留：`taskStatuses`、`initialTaskStatus`、`assertTaskStatusTransition` 的现有契约。

- `app/routes.ts`
  - 当前状态：仅显式注册 `/workspace`，尚无任务详情子路由。
  - 本 story 要改：若选择单独详情路由，必须在这里增加 route 声明并保持受保护边界一致。
  - 必须保留：已有登录、回调、登出、健康检查路由定义。

### Recommended File Structure

- 新增的任务域 UI 组件优先放在 `app/features/tasks/`，例如：
  - `app/features/tasks/components/TaskListPanel.tsx`
  - `app/features/tasks/components/TaskDetailTimeline.tsx`
  - `app/features/tasks/components/TaskStatusSummaryCard.tsx`
- 新增的读取逻辑优先放在 `app/features/tasks/server/`，例如：
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-timeline.server.ts`
- 如果要新增任务详情 route，优先保持 React Router 约定式命名并同步修改 `app/routes.ts`，避免把 task detail 继续塞回 `WorkspaceShell` 的局部状态里。
- `shared/` 只应保留真正跨领域稳定复用的原子级 UI 或工具；任务列表、详情、状态时间线都不是共享层的责任。

### Read Model and API Guidance

- 列表 read model 推荐最少返回：
  - `id`
  - `status`
  - `sourceIdentifier`
  - `sourceTitle`
  - `latestEventType`
  - `latestEventAt`
  - `latestProgressLabel`
  - `createdAt`
  - `updatedAt`
- 列表分页元数据至少返回：
  - `page`
  - `pageSize`
  - `total`
- 详情 read model 推荐最少返回：
  - `task summary`
  - `currentStatus`
  - `currentStageLabel`
  - `latestProgressLabel`
  - `requestId`（如当前终态或最新关键事件可用）
  - `events[]`（按时间顺序）
- 时间线事件不要把数据库里的所有 payload 生硬透传到 UI。先做 server-side mapping，只暴露当前 story 需要的可读字段。

### Implementation Guardrails

- 不要在列表页查询完整 `task_events` 历史，然后在组件里手动筛最后一条；这会直接违背分页和性能要求。
- 不要把详情状态组织逻辑直接写死在 JSX 条件分支里；阶段映射和状态 label 至少应有一个可测试的 helper。
- 不要为了“实时感”提前实现 SSE 或轮询；Story 1.5 只消费已有真源，Story 1.6 再处理增量同步。
- 不要把 task-specific UI 继续堆进 `WorkspaceShell` 直到它变成第二个 `pages/` 黑盒。
- 不要在前端自己拼装“伪状态”，例如用 `latestEventType` 替代顶层 `status` 做筛选。
- 不要让详情页面泄露其他用户任务；本地 RBAC 和 creator ownership 仍然是唯一授权真源。

### Testing Requirements

- 必须覆盖：
  - 分页列表只返回单页数据与正确 `meta.pagination`
  - 任务详情读取按时间顺序返回事件账本
  - 非本人任务详情访问被拒绝，且保留统一错误结构
  - 顶层状态与阶段 label 映射不会偏离 `task-status.server.ts`
  - 列表到详情的键盘导航、焦点可见性、语义标签和状态文本表达
- 至少保留并继续通过：
  - `tests/task-intake.test.ts`
  - `tests/task-events.test.ts`
  - `tests/e2e/workspace-shell.test.mjs`
  - `tests/auth-flow.test.ts`
  - `tests/session.test.ts`
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### Latest Technical Information

- 截至 2026-05-26，React Router 官方最新文档分支已到 `7.15.1`，仍明确把 `loader` / `clientLoader` 作为 Framework Mode 数据加载主轴，并强调 `loader` 会从 client bundle 中剔除，因此受保护任务列表和详情读取继续放在 server-side loader / `.server` helper 中是当前正确方向，而不是过早把权限读取逻辑迁到浏览器端。[Official: `https://reactrouter.com/start/framework/data-loading`]
- TanStack Query 最新文档仍强调：面对用户动作导致的数据过期时，应优先使用定向 `invalidateQueries` 与后台 refetch，而不是手工维护一套归一化本地缓存。Story 1.5 如果开始引入 Query Cache，应围绕 task list / task detail 做“定向失效 + 局部更新”，不要做全局缓存拼图。[Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]
- WCAG 2.1 对“Use of Color”和“Status Messages”的理解文档都继续要求：状态信息不能只靠颜色传达，且不抢焦点的状态更新也要能被辅助技术感知。Story 1.5 的状态 pill、时间线、分页切换反馈和详情内联状态都必须满足这一点。[Official: `https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html`, `https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html`]

### Project Context Reference

- 通过 workflow `persistent_facts` 约定的 `project-context.md` 全仓扫描未找到匹配文件。
- 当前可用项目上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/*.md`
  - 已完成的 Story 1.3 / 1.4 implementation artifacts
- 本仓库协作约定仍需遵守：
  - 路径优先使用绝对路径
  - 破坏性操作前先说明并二次确认
  - 跨工具通用知识写入 `knowledge/`，流程写入 `skills/`

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-1.5`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md#Functional-Requirements`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Frontend Architecture`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Task Status Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Performance and Bundle Strategy`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Format Patterns`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#High-Risk Divergence Pre-Mortem`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#流程阶段时间线--状态账本`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#运行中状态卡`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Navigation Patterns`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/workspace.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/routes.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/shared/ui/WorkspaceShell.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-events.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-status.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/tasks.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/task-events.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-events.test.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/e2e/workspace-shell.test.mjs`]
- [Official: `https://reactrouter.com/start/framework/data-loading`]
- [Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]
- [Official: `https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html`]
- [Official: `https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html`]

## Dev Agent Record

### Agent Model Used

GPT-5 (create-story context generation)

### Debug Log References

- Story created from Epic 1 / Story 1.5 context
- Reviewed sprint status, epics, PRD, architecture, UX specification, Story 1.4 artifact, recent commits, and current workspace/task code before authoring
- Verified latest official guidance for React Router data loading, TanStack Query invalidation, and WCAG status/color accessibility rules
- Implemented route-driven workspace task list and direct task detail route while preserving Story 1.3 intake flow and protected shell
- Added paginated task read models, readable stage/status mapping helpers, and task-domain UI panels under `app/features/tasks`
- Verified with `pnpm typecheck`, `pnpm test`, and `pnpm build`

### Completion Notes List

- Reworked `/workspace` into a real task list entry and added shareable task detail route `/workspace/tasks/:taskId`
- Added `task-query.server.ts` and `workspace-view.server.ts` to separate paginated list, detail ledger, authorization, and loader composition from intake logic
- Extended `task-status.server.ts` with readable status/stage mapping so UI copy stays derived from the single top-level status contract
- Moved task list, detail summary, and timeline UI into `app/features/tasks/components/` and kept `WorkspaceShell` focused on protected shell + intake slots
- Added regression coverage for task query helpers, workspace loader composition, and updated workspace shell affordance checks
- Validation completed successfully: `pnpm typecheck`, `pnpm test`, `pnpm build`

## Change Log

- 2026-05-26: Created Story 1.5 implementation context and marked it ready for development.
- 2026-05-26: Implemented paginated task list, direct detail route, stage timeline UI, and supporting tests; moved story to `review`.

### File List

- _bmad-output/implementation-artifacts/1-5-creator-task-list-and-detail-status-views.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/app.css
- app/features/tasks/components/CreatorWorkspaceScreen.tsx
- app/features/tasks/components/TaskDetailPanel.tsx
- app/features/tasks/components/TaskDetailTimeline.tsx
- app/features/tasks/components/TaskListPanel.tsx
- app/features/tasks/components/TaskStatusSummaryCard.tsx
- app/features/tasks/components/task-formatters.ts
- app/features/tasks/server/task-query.server.ts
- app/features/tasks/server/task-status.server.ts
- app/features/tasks/server/workspace-view.server.ts
- app/routes.ts
- app/routes/workspace.task-detail.tsx
- app/routes/workspace.tsx
- app/shared/ui/WorkspaceShell.tsx
- tests/e2e/workspace-shell.test.mjs
- tests/task-query.test.ts
- tests/workspace-view.test.ts
- tsconfig.vite.tsbuildinfo
