# Story 6.1: Core Operations KPI Overview

Status: done

## Story

As a 运营或管理角色,
I want 查看预设命中、复用、关键耗时与人工介入概览,
so that 我能快速判断 Yakimoji 的核心价值是否成立。

## Acceptance Criteria

1. **Given** 运营或管理角色具备查看运营视图的内部权限  
   **When** 其进入运营可见性页面或等价面板  
   **Then** 系统必须展示围绕频道预设工作台价值的核心指标与视图  
   **And** 该视图必须与普通创作者工作台权限边界清楚区分
2. **Given** 系统中存在已创建任务  
   **When** 运营或管理角色查看运营视图  
   **Then** 系统必须能够展示任务是否成功命中频道预设  
   **And** 运营能够区分命中已有预设、创建新预设后继续、手动复用预设继续与未使用预设继续等关键路径
3. **Given** 系统持续产生任务数据  
   **When** 运营或管理角色查看关键耗时信息  
   **Then** 系统必须能够展示任务从导入到进入处理以及最终完成的关键耗时  
   **And** 这些耗时必须能够按任务或聚合视角被理解，而不是只存在原始日志中
4. **Given** 任务在不同阶段可能发生失败、中断或人工介入  
   **When** 运营或管理角色查看流程可见性  
   **Then** 系统必须能够展示这些事件主要发生在哪些环节  
   **And** 运营角色应能够据此判断流程中最常见的摩擦点
5. **Given** 系统已有一定数量的频道预设和任务  
   **When** 运营或管理角色查看预设复用情况  
   **Then** 系统必须能够展示频道预设复用情况  
   **And** 该能力应直接支撑产品是否兑现预设资产复用核心命题的判断
6. **Given** 团队交付第一版运营视图  
   **When** 运营面板定义范围  
   **Then** 第一版仅要求提供 3 到 5 个核心指标与 drill-down 到任务列表的能力  
   **And** 每个核心指标都必须有明确名称、计算口径和状态解释
7. **Given** 第一版运营面板展示预设命中率与预设复用率  
   **When** 运营角色查看指标说明或 drill-down 结果  
   **Then** 系统必须分别按本 story 中定义的 `presetOutcome` 口径计算  
   **And** 不得把“新建预设后继续”或“未使用预设继续”错误计入复用率
8. **Given** 第一版运营面板展示导入到进入处理耗时  
   **When** 运营角色查看该指标  
   **Then** 系统必须明确展示统计时间窗口与 `median`、`p95` 口径  
   **And** 单任务耗时必须从 `task created` 计算到首次进入 `queued` 或 `processing`
9. **Given** 第一版运营面板展示人工介入任务占比或失败/中断任务占比  
   **When** 运营角色查看这些指标  
   **Then** 系统必须基于本 story 中约定的状态集合计算  
   **And** drill-down 列表必须能够展示触发该指标的具体任务

## Tasks / Subtasks

- [x] 建立 ops-only 访问入口与独立运营视图骨架
- [x] 以正式 6.1 KPI 口径重建运营聚合查询与卡片文案
- [x] 提供按 KPI 样本与预设结果下钻到任务列表的最小闭环
- [x] 在下钻列表中展示 task id、来源、preset outcome、当前状态、创建时间与关键阶段时间戳
- [x] 补齐 ops 读模型、授权与页面结构回归测试
- [x] 运行 `pnpm typecheck`
- [x] 运行 `pnpm test`
- [x] 运行 `pnpm build`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-20T23:59:33+0800: rebuilt the operations dashboard to align with the official Story 6.1 KPI definitions and drill-down contract
- Validation commands: `pnpm typecheck`, `pnpm test`, `pnpm build`

### Completion Notes List

- Replaced the mixed 6.1/6.2 dashboard framing with the official 6.1 KPI set: preset hit rate, preset reuse rate, import-to-processing timing, human-intervention rate, and failure/interruption rate
- Preserved the ops/admin-only `/operations` access path and tightened the summary copy so the page explicitly explains its first-version KPI scope and data limitations
- Reworked the supporting panel into a preset-outcome breakdown with drill-down links for each continuation path instead of surfacing non-match-source analysis as a primary KPI
- Expanded the drill-down table to include task id, source identifier, preset outcome, current status, created time, and key stage timestamps
- Rewrote route and aggregation regression tests to match the official story ACs and verified the final implementation with `pnpm typecheck`, `pnpm test`, and `pnpm build`

### File List

- `_bmad-output/implementation-artifacts/6-1-core-operations-kpi-overview.md`
- `_bmad-output/implementation-artifacts/6-1-operations-visibility-dashboard-for-preset-reuse-and-task-flow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/operations/components/OperationsDashboardScreen.tsx`
- `app/features/operations/components/OperationsDrilldownTable.tsx`
- `app/features/operations/server/operations-dashboard.server.ts`
- `tests/operations-dashboard.test.ts`
- `tests/operations-route.test.ts`

## Change Log

- 2026-06-20: rebuilt Story 6.1 around the official KPI contract and synchronized BMAD implementation artifacts with sprint tracking
