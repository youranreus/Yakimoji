# Story 6.2: Channel-level Non-match Analysis

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 运营或管理角色,
I want 查看哪些来源频道反复未命中预设,
so that 我能判断是识别问题、预设覆盖不足还是流程沉淀不足。

## Acceptance Criteria

1. **Given** 系统中存在多条任务记录  
   **When** 运营或管理角色查看来源频道维度信息  
   **Then** 系统必须能够显示哪些来源频道反复未命中预设  
   **And** 该视图必须能按来源频道聚合未命中次数或等价指标
2. **Given** 某个来源频道存在多次未命中记录  
   **When** 运营查看该来源频道的详情或 drill-down 结果  
   **Then** 系统必须能够展示相关任务列表或等价明细  
   **And** 不得要求运营角色通过底层任务事件或技术日志自行拼装产品结论

## Tasks / Subtasks

- [x] 建立独立于 6.1 KPI 总览的 6.2 运营入口，并保持同域授权与视觉语言 (AC: 1, 2)
  - [x] 新增 `/operations/non-match-sources` 独立 route / loader，而不是把 6.2 再塞回 6.1 主面板
  - [x] 继续复用 `requireAnyRole(["ops", "admin"])` 作为访问边界
  - [x] 在运营导航中显式区分“核心指标总览”和“反复未命中频道”

- [x] 在 server 层按来源频道聚合未自动命中已有预设的任务样本 (AC: 1)
  - [x] 复用 `tasks` 与 `task_events` 作为真源，不引入新的统计表
  - [x] 只统计来源已识别但未 `matched` 的任务，并区分 `manual_reuse`、`manual_create`、`continue_without_preset`、`unresolved`
  - [x] 按来源频道聚合未命中次数、最近样本时间和主要去向说明

- [x] 提供来源频道级 drill-down 到任务样本的最小闭环 (AC: 2)
  - [x] 选中来源频道后展示该频道下的相关任务列表
  - [x] 任务列表保留 task id、来源、预设结果、当前状态、创建时间与关键阶段时间戳
  - [x] helper 文案直接解释“为什么值得关注这个频道”，而不是让运营自行读事件

- [x] 保持 6.2 与 6.1 / 6.3 的清晰边界 (AC: 1, 2)
  - [x] 6.1 继续聚焦 KPI 总览和任务范围下钻，不再承担反复未命中频道主分析
  - [x] 6.2 聚焦来源频道维度聚合，不扩展到单任务最小审计记录
  - [x] 6.3 继续承载 task-level audit 能力，不与 6.2 混写

- [x] 补齐回归测试并完成验证 (AC: 1, 2)
  - [x] 新增 server 层测试，覆盖来源频道聚合、重复未命中排序、来源 drill-down 过滤
  - [x] 新增 route/UI 结构测试，锁定独立路由、导航入口和关键文案
  - [x] 运行 `pnpm typecheck`
  - [x] 运行 `pnpm test`
  - [x] 运行 `pnpm build`

## Dev Notes

### Story Intent

- 6.2 回答的是“哪些来源频道反复没有自动命中预设，以及这些样本最终走向了哪里”。
- 这不是新的 KPI 卡片堆砌，而是给运营一个能快速定位“识别问题 vs 资产覆盖不足”的频道级判断面。
- 6.2 必须避免退化成底层事件浏览器，也不能误写成 6.3 的 task audit 页面。

### Current Codebase State

- 现有 6.1 实现已经把“反复未命中来源频道”从主面板移除，改成了预设路径分布，因此 6.2 需要独立视图承接这块需求。
- `operations-dashboard.server.ts` 已具备读取最近任务、读取事件、识别 `presetPath`、构造任务列表项的基础能力。
- 当前仓库已存在一次历史编号漂移：任务审计实现曾误占 `6-2` 文件名；本次已纠正为 6.3，并按 canonical `epics.md` 重新创建真实 6.2 story 制品。

### File List

- `_bmad-output/implementation-artifacts/6-2-channel-level-non-match-analysis.md`
- `_bmad-output/implementation-artifacts/6-3-minimum-audit-record-and-queryable-task-history.md`
- `app/app.css`
- `app/features/operations/components/OperationsDrilldownTable.tsx`
- `app/features/operations/components/OperationsNonMatchAnalysisScreen.tsx`
- `app/features/operations/server/operations-dashboard.server.ts`
- `app/features/operations/server/operations-non-match-analysis.server.ts`
- `app/routes.ts`
- `app/routes/operations.non-match-sources.tsx`
- `tests/operations-non-match-analysis.test.ts`
- `tests/operations-route.test.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-22T14:39:14+0800: corrected Epic 6 artifact numbering drift so the existing task audit implementation is tracked as Story 6.3 and Story 6.2 can be re-implemented against the canonical epics scope
- 2026-06-22T14:39:14+0800: added a dedicated `/operations/non-match-sources` route, source-level aggregation read model, reusable operations drill-down wiring, and regression coverage for repeated non-match channel analysis
- 2026-06-22T14:39:14+0800: verification passed with `pnpm typecheck`, `pnpm test`, and `pnpm build`

### Completion Notes List

- Reintroduced Story 6.2 as an independent operations surface instead of folding it back into the 6.1 KPI dashboard.
- Grouped non-matched tasks by source channel and summarized whether those tasks were manually reused, needed new presets, continued without presets, or remain unresolved.
- Added source-specific drill-down so operations can move from channel-level problem identification to concrete task samples without reading raw events.
- Corrected BMAD implementation artifacts so Story 6.2 and Story 6.3 now match the canonical `epics.md` / `sprint-status` numbering again.

### Change Log

- 2026-06-22: recreated Story 6.2 from the canonical Epic 6 scope after correcting the historical 6.2/6.3 artifact numbering drift
- 2026-06-22: implemented the dedicated operations non-match source analysis route, server aggregation, shared drill-down integration, and regression coverage

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-22

Findings:

- 6.2 现在作为独立运营视图承接来源频道重复未命中分析，不再把 6.1 KPI 总览和 6.3 单任务审计混在同一入口。
- 聚合和 drill-down 都建立在现有 `tasks` / `task_events` 真源之上，没有再发明第二套运营状态模型。
- BMAD story 制品与 `sprint-status` 的 6.2 / 6.3 编号已经重新对齐，后续流程不再会把任务审计误判成 6.2。

Decision:

- Approve。Story 6.2 已满足来源频道级重复未命中分析与任务级下钻的交付范围。
