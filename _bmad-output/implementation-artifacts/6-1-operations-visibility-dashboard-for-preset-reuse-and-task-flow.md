# Story 6.1: Operations Visibility Dashboard for Preset Reuse and Task Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 运营或管理角色,
I want 查看预设命中、未命中、复用情况与关键耗时,
so that 我能判断 Yakimoji 的核心价值是否真的成立。

## Acceptance Criteria

1. **Given** 运营或管理角色具备查看运营视图的内部权限  
   **When** 其进入运营可见性页面或等价面板  
   **Then** 系统必须展示围绕频道预设工作台价值的核心指标与视图  
   **And** 该视图必须与普通创作者工作台权限边界清楚区分
2. **Given** 系统中存在已创建任务  
   **When** 运营或管理角色查看运营视图  
   **Then** 系统必须能够展示任务是否成功命中频道预设  
   **And** 运营能够区分命中已有预设、创建新预设后继续、手动复用预设继续与未使用预设继续等关键路径
3. **Given** 系统中存在多条任务记录  
   **When** 运营或管理角色查看来源频道维度信息  
   **Then** 系统必须能够显示哪些来源频道反复未命中预设  
   **And** 该视图应足以帮助判断是识别问题、预设覆盖不足还是流程沉淀不足
4. **Given** 系统持续产生任务数据  
   **When** 运营或管理角色查看关键耗时信息  
   **Then** 系统必须能够展示任务从导入到进入处理以及最终完成的关键耗时  
   **And** 这些耗时必须能够按任务或聚合视角被理解，而不是只存在原始日志中
5. **Given** 任务在不同阶段可能发生失败、中断或人工介入  
   **When** 运营或管理角色查看流程可见性  
   **Then** 系统必须能够展示这些事件主要发生在哪些环节  
   **And** 运营角色应能够据此判断流程中最常见的摩擦点
6. **Given** 系统已有一定数量的频道预设和任务  
   **When** 运营或管理角色查看预设复用情况  
   **Then** 系统必须能够展示频道预设复用情况或复用趋势  
   **And** 该能力应直接支撑产品是否兑现预设资产复用核心命题的判断
7. **Given** 运营角色查看这些面板或统计信息  
   **When** 页面展示关键指标  
   **Then** 指标命名和状态解释必须清楚可读  
   **And** 不得要求运营角色通过底层任务事件或技术日志自行拼装产品结论
8. **Given** 团队交付第一版运营视图  
   **When** 运营面板定义范围  
   **Then** 第一版仅要求提供 3 到 5 个核心指标与 drill-down 到任务列表的能力  
   **And** 本 story 不要求实现完整 BI 仪表盘、复杂告警系统或深度多维分析

## Tasks / Subtasks

- [x] 建立 ops-only 访问入口与独立运营视图骨架，避免复用 creator/support 工作台权限路径 (AC: 1, 7, 8)
  - [x] 新增显式 route 与 loader，例如 `app/routes/operations.tsx`，并在 `app/routes.ts` 注册，而不是把运营视图偷偷塞进 `/workspace`
  - [x] 通过统一授权入口校验 `ops` 角色；若允许 `admin` 旁路访问，必须在 `authz` 层集中实现，不得在 route 内散落多套判断
  - [x] 运营视图页面结构必须与 creator intake / support diagnostics 区分，避免暴露任务导入、预设编辑和 creator 专属动作

- [x] 为 Epic 6 第一版定义 3 到 5 个核心指标和清晰的解释文案 (AC: 2, 4, 5, 6, 7, 8)
  - [x] 至少覆盖：预设命中率/命中分布、反复未命中来源、进入处理耗时、完成耗时或完成率、失败/人工介入摩擦点之一
  - [x] 所有指标文案必须直接面向运营语义，例如“自动命中已有预设”“反复未命中来源”“进入处理耗时”，不得把原始 event type 暴露为 UI 主文案
  - [x] 对数据不足、缺少完成事件、没有可计算耗时的样本，必须明确展示“暂无足够数据”而不是伪造 0 值或静默丢失

- [x] 基于现有 `tasks`、`task_events`、`preset_snapshot` 建立运营聚合查询层，而不是引入新状态真源 (AC: 2, 3, 4, 5, 6)
  - [x] 将预设路径分类统一映射为 `matched`、`manual_create`、`manual_reuse`、`continue_without_preset`、`unresolved` 等既有语义，避免在运营视图发明第二套枚举
  - [x] 反复未命中来源应按 `tasks.sourceIdentifier` 聚合，并用 `presetSnapshot.status in ('continue_without_preset', 'unresolved', 'none')` 或等价规则归类为未命中/未沉淀样本
  - [x] “导入到进入处理耗时”优先使用 `tasks.createdAt -> 首个 queued/processing 相关事件 createdAt`，最终完成耗时使用 `tasks.createdAt -> completed event createdAt`；缺失事件时只计入可计算样本
  - [x] 流程摩擦点应来自 `task_events` 中失败、人工确认、retry 或预设决策请求等关键节点的聚合计数，而不是依赖还未交付的 6.2 审计查询接口

- [x] 提供 drill-down 到任务列表的最小闭环，保证指标不是死卡片 (AC: 3, 4, 5, 8)
  - [x] 运营指标卡或聚合行必须能跳到带筛选条件的任务列表视图，至少支持按预设路径、来源频道或异常类型缩小范围
  - [x] 若复用现有列表组件或任务详情组件，必须通过新 read model 提供运营上下文，不得强迫 ops 用户走 creator-only `/workspace` 权限链
  - [x] 第一版只要求最小 drill-down 与可读任务列表，不要求完整跨维分析器、图表库矩阵或导出系统

- [x] 复用现有 shell / card / status 呈现模式，但保持运营信息架构独立 (AC: 1, 7, 8)
  - [x] 可复用现有 `shell-panel`、`status-pill`、列表/详情节奏与可访问性样式，避免为了仪表盘引入新的重 UI 框架
  - [x] 关键指标优先采用简洁卡片、表格或分组列表表达，第一版不需要引入复杂图表依赖
  - [x] 页面必须明确说明这些指标的含义与范围，例如只统计当前保留窗口内可见任务、只基于已落库事件计算等

- [x] 补齐 ops 聚合、授权和 drill-down 回归测试 (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 新增 server 层测试，覆盖预设路径分类、反复未命中来源聚合、耗时计算、摩擦点统计和空样本回退
  - [x] 新增 loader / route 测试，覆盖 `ops` 可访问、非授权拒绝、`admin` 是否旁路访问的最终决策
  - [x] 新增 UI/结构测试，锁定指标标题、解释文案与 drill-down 链接存在，不让页面退化成只显示原始 JSON
  - [x] 完成后至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

### Review Findings

- [x] [Review][Patch] 缺少按异常类型下钻到任务列表的能力 [app/features/operations/server/operations-dashboard.server.ts:67]
- [x] [Review][Patch] “自动命中与复用占比”卡片的下钻口径与统计口径不一致，只能看到 `matched` 任务 [app/features/operations/server/operations-dashboard.server.ts:599]
- [x] [Review][Patch] “反复未命中来源”卡片的下钻遗漏 `unresolved` 样本，导致指标与明细不一致 [app/features/operations/server/operations-dashboard.server.ts:622]
- [x] [Review][Patch] 运营页先拉取全部任务和全部事件再做筛选分页，数据量增长后会退化为全表扫描 [app/features/operations/server/operations-dashboard.server.ts:424]
- [x] [Review][Patch] 分页没有把越界页码钳制到有效范围，可能展示“第 999 页 / 共 2 页”的空结果 [app/features/operations/server/operations-dashboard.server.ts:170]

## Dev Notes

### Story Intent

- 6.1 的目标是交付“最小可用的运营判断台”，让团队能够回答“预设是否真的被复用”“哪里反复没命中”“任务卡在哪些阶段”，而不是做完整 BI 系统。
- 第一版必须把指标、解释和 drill-down 放在一起，避免只做静态概览卡片。
- 6.1 不应抢做 6.2 的任务级最小审计记录查询；本 story 聚焦聚合视图与任务范围下钻。

### Business and Epic Context

- PRD 把预设复用率定义为第一阶段最关键的北极星指标之一，Epic 6 则是把这件事产品化，而不是让运营靠数据库或日志手算。
- 用户旅程 3 明确要求“预设复用率、各频道命中情况、导入到进入处理的耗时、失败或打断最多的节点”能够被运营或管理角色快速判断。
- 这意味着 6.1 必须优先回答价值验证问题，而不是围绕图表丰富度扩 scope。

### Dependencies and Boundaries

- 直接依赖已有任务与支持能力，但不要求修改创作者核心流程：
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/tasks/server/task-status.server.ts`
  - `database/schema/tasks.ts`
  - `database/schema/task-events.ts`
  - `database/schema/auth.ts`
- 需要复用本地 RBAC 体系与统一授权入口：
  - `app/features/auth/server/authz.server.ts`
  - `app/features/auth/server/session.server.ts`
- 与 Story 3.3 的 support 诊断模式相关，但不要把 support-only detail 误当成 ops dashboard：
  - `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
- 明确不在本 story 完成：
  - 任务级最小审计记录独立查询接口
  - 完整 BI 仪表盘/图表系统
  - 告警、订阅、导出、定时报表

### Current Codebase State

- 当前路由只有 `/workspace` 创作者工作台、`/workspace/tasks/:taskId` 详情、support-only task detail，以及 API/下载路由；没有专门的 ops route。
- `loadWorkspaceViewModel()` 只处理 `creator` 与 `support` 两类工作台模式，并依赖 `requireRole()` 进行单角色校验；如果 6.1 需要 `ops` 或 `admin`，应该在这一层或新的运营 loader 中集中实现。
- 现有任务读模型已经具备多项可直接复用的数据：
  - `tasks.presetSnapshot.status` 已区分 `matched`、`manual_reuse`、`manual_create`、`continue_without_preset`、`unresolved`
  - `tasks.sourceIdentifier` 可用于来源频道聚合
  - `task_events` 已保存 `eventType`、`fromStatus`、`toStatus`、`reasonCode`、`requestId`、`payload`、`createdAt`
  - `task-diagnostics.server.ts` 已证明基于事件账本提取 review / failure / retry 上下文的模式可行
- 当前 `WorkspaceShell` 已有 creator/support 两种壳层布局，说明 6.1 可以复用壳层样式语言，但不应把运营视图混进 creator intake 区域。
- 当前测试已覆盖：
  - creator/support 工作台权限切换
  - 任务列表分页与详情读模型
  - support-only 诊断视图
  - 这为新增 ops-only loader、聚合查询和独立页面提供了可延展的测试模式

### Data and Metric Modeling Guidance

- 预设路径分类建议以 `presetSnapshot.status` 为单一真源，统一映射成运营文案：
  - `matched` -> 自动命中已有预设
  - `manual_reuse` -> 手动复用已有预设
  - `manual_create` -> 新建最小预设后继续
  - `continue_without_preset` / `unresolved` / `none` -> 未命中或未沉淀为预设
- 反复未命中来源建议至少返回：
  - `sourceIdentifier`
  - 未命中任务数
  - 最近一次出现时间
  - 最近采用的继续路径
  - 可 drill-down 的筛选链接或筛选参数
- 耗时指标至少区分两段：
  - 导入到进入处理：`tasks.createdAt -> 首个 queued/processing 相关事件`
  - 导入到完成：`tasks.createdAt -> completed event`
- 流程摩擦点可优先统计：
  - `task.preset_decision_requested`
  - `task.review_required` / `task.human_review_requested`
  - `task.failed`
  - `task.retry_requested`
- 所有聚合必须说明统计口径；如果某项仅基于已完成任务或仅基于有完整事件链的任务样本，UI 中要说清楚。

### Architecture Compliance

- 必须继续遵守统一任务状态与事件契约：运营视图可以聚合 `task_events`，但不能新建第二套状态枚举或事件命名。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守本地 RBAC 是唯一授权真源：`ops`/`admin` 访问判断不能直接来自 SSO provider role。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守 domain-first 结构：若新增运营读模型，优先建立 `app/features/operations/` 或等价 ops 域模块，而不是把聚合 helper 丢进全局 `shared/utils`。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守“Route Bootstrap + Selective Query Cache”模式：如果运营页需要客户端交互，不要先上全局状态库；先用 loader/bootstrap 数据和必要的局部缓存。[Source: `_bmad-output/planning-artifacts/architecture.md`]
- 必须继续遵守错误与空态可解释性：页面关键失败或无数据场景应有内联解释，不要只给空白卡片或 toast。[Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]

### UX and Interaction Guardrails

- 第一版运营页优先做成“判断台”而不是“图表墙”：3 到 5 个高信号卡片 + 1 个来源或任务列表 + drill-down 即可满足目标。
- 指标命名必须站在运营视角，例如“自动命中已有预设占比”“反复未命中来源”“进入处理耗时”，不要把 `manual_reuse`、`task.review_required` 直接丢给用户当主标签。
- 页面应明确区分：
  - 价值类指标：预设命中/复用
  - 速度类指标：进入处理/完成耗时
  - 摩擦类指标：失败、人工确认、反复未命中
- 不要在 6.1 引入复杂可视化依赖。简洁卡片、表格、分组列表和状态 pill 足够完成第一版目标。

### File Structure Requirements

- 优先新增或修改：
  - `app/routes.ts`
  - `app/routes/operations.tsx` 或等价运营 route
  - `app/features/operations/server/operations-dashboard.server.ts`
  - `app/features/operations/components/OperationsDashboardScreen.tsx`
  - `app/features/operations/components/OperationsMetricCards.tsx`
  - `app/features/operations/components/OperationsDrilldownTable.tsx`
  - `app/features/auth/server/authz.server.ts`（如需支持多角色授权 helper）
  - `app/app.css`
  - `tests/operations-dashboard.test.ts`
  - `tests/operations-route.test.ts`
  - `tests/e2e/workspace-shell.test.mjs` 或新增同级结构测试
- 可复用但要谨慎：
  - `app/shared/ui/WorkspaceShell.tsx`
  - `app/features/tasks/server/task-query.server.ts`
  - `app/features/tasks/components/task-formatters.ts`
- 不要新增：
  - 专门的 BI SDK 集成
  - 大而全 chart abstraction
  - 与 6.2 重叠的 task audit query API

### Testing Requirements

- 必须覆盖：
  - `ops` 角色可访问运营页，非授权用户被拒绝
  - 预设路径分类不会把 `matched/manual_reuse/manual_create/continue_without_preset` 混淆
  - 反复未命中来源按 `sourceIdentifier` 正确聚合
  - 进入处理耗时与完成耗时只基于可计算事件链计算
  - failure/review/retry 聚合不会吞掉 request context 或错误归因
  - 指标卡存在 drill-down 链接，并能落到任务列表或等价列表筛选视图
  - 空数据、缺失事件和无完成样本时有明确文案
- 优先扩展或新增：
  - `tests/workspace-view.test.ts` 的权限/路由模式思路
  - `tests/task-query.test.ts` 的读模型映射思路
  - 新增 `tests/operations-dashboard.test.ts`
  - 新增 `tests/operations-route.test.ts`
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### Git Intelligence Summary

- 最近提交显示当前代码推进风格偏“在既有骨架上增量扩展”，而不是大重构：
  - `ab0101f feat: complete epic 5 mobile follow-through`
  - `764d745 chore: mark epic 1 done in sprint status`
  - `851abcc fix: remove internal copy from user-facing pages`
- 这意味着 6.1 更适合沿用现有 route + feature + shell 结构扩出 ops 视图，不适合一上来重写工作台架构。

### Latest Technical Information

- 截至 **2026-06-13**，React Router 官方文档仍把 framework actions / loaders 作为正式数据写入与页面 bootstrap 主路径；因此 6.1 的运营页应继续走 route loader + server read model，而不是在页面组件里手写一套孤立 `fetch()` 生命周期。[Official: `https://reactrouter.com/start/framework/actions`]
- 截至 **2026-06-13**，React Router 官方 `useFetcher` 文档仍强调它适合“不引发导航”的交互；如果 6.1 需要局部筛选或轻量 drill-down 控件，可优先沿用 `fetcher` 模式，而不是引入新的全局状态容器。[Official: `https://reactrouter.com/api/hooks/useFetcher`]
- 截至 **2026-06-13**，TanStack Query 官方最新文档仍把 query invalidation 视为服务端数据变化后的核心同步机制；如果后续给运营页补高频刷新，应复用既有“服务端真源 + 定向失效”思路，而不是让仪表盘组件自己维护第二套业务状态机。[Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]

### Project Context Reference

- workflow `persistent_facts` 指向的 `project-context.md` 全仓扫描未找到匹配文件。
- 当前有效项目上下文来自：
  - `AGENTS.md`
  - `_bmad-output/planning-artifacts/epics.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`
  - 现有 `app/routes/*`、`app/features/tasks/*`、`app/features/auth/*`、`database/schema/*` 真实代码

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic-6-Operational-Visibility-and-Auditability`]
- [Source: `_bmad-output/planning-artifacts/prd.md`]
- [Source: `_bmad-output/planning-artifacts/architecture.md`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]
- [Source: `_bmad-output/implementation-artifacts/3-3-support-timeline-and-diagnostic-context.md`]
- [Source: `app/routes.ts`]
- [Source: `app/routes/workspace.tsx`]
- [Source: `app/features/tasks/server/workspace-view.server.ts`]
- [Source: `app/features/tasks/server/task-query.server.ts`]
- [Source: `app/features/tasks/server/task-diagnostics.server.ts`]
- [Source: `app/shared/ui/WorkspaceShell.tsx`]
- [Source: `app/features/auth/server/authz.server.ts`]
- [Source: `database/schema/auth.ts`]
- [Source: `database/schema/tasks.ts`]
- [Source: `database/schema/task-events.ts`]
- [Source: `tests/workspace-view.test.ts`]
- [Source: `tests/task-query.test.ts`]
- [Official: `https://reactrouter.com/start/framework/actions`]
- [Official: `https://reactrouter.com/api/hooks/useFetcher`]
- [Official: `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- create-story workflow executed manually with customization fallback because local `python3` lacks stdlib `tomllib`
- 2026-06-13: implemented `/operations` route, centralized `ops/admin` authorization, ops read model, and dashboard drill-down task list
- Validation commands: `pnpm typecheck`, `pnpm test`, `pnpm build`

### Completion Notes List

- Added a dedicated ops-only `/operations` route and centralized `requireAnyRole()` authorization path for `ops`/`admin`
- Implemented first-pass operations dashboard aggregation over `tasks` and `task_events`, including preset coverage, repeat misses, start/completion timing, and friction signals
- Added same-page drill-down filtering to task lists so metrics and repeat-miss rows can narrow by preset path, source, or friction type without using creator-only workspace paths
- Added regression coverage for ops dashboard aggregation, route access, admin bypass, and UI structure; verified with `pnpm typecheck`, `pnpm test`, and `pnpm build`
- Story intentionally stays within 6.1 scope; task-level audit querying remains deferred to Story 6.2

### File List

- `_bmad-output/implementation-artifacts/6-1-operations-visibility-dashboard-for-preset-reuse-and-task-flow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/auth/server/authz.server.ts`
- `app/features/operations/components/OperationsDashboardScreen.tsx`
- `app/features/operations/components/OperationsDrilldownTable.tsx`
- `app/features/operations/components/OperationsMetricCards.tsx`
- `app/features/operations/server/operations-dashboard.server.ts`
- `app/routes.ts`
- `app/routes/operations.tsx`
- `tests/operations-dashboard.test.ts`
- `tests/operations-route.test.ts`
- `tsconfig.vite.tsbuildinfo`

## Change Log

- 2026-06-13: delivered the first-pass operations visibility dashboard with ops/admin authorization, server-side aggregations, drill-down task filtering, and regression coverage
