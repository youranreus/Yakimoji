# Story 2.3: Unknown Source Manual Resolution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在未命中预设时完成一次轻量人工决策并继续当前任务,
so that 陌生频道不会把我拖进复杂后台或打断当前任务目标。

## Acceptance Criteria

1. **Given** 创作者导入了一个任务且系统未命中任何已有频道预设  
   **When** 来源识别完成并确认属于陌生频道场景  
   **Then** 页面必须明确告知当前任务未命中现有预设  
   **And** 不能把该情况伪装成普通命中成功或静默跳过说明
2. **Given** 当前任务未命中任何已有预设  
   **When** 系统展示陌生频道决策界面  
   **Then** 页面必须并列提供三种明确路径：复用已有预设、创建新的最小频道预设、在不保存频道预设的前提下继续当前任务  
   **And** 不得通过默认视觉弱化其中某一条路径来强迫用户接受某个系统偏好
3. **Given** 创作者完成其中任一路径的人工决策  
   **When** 任务继续创建  
   **Then** 系统必须把这次决策结果固化为当前任务的明确来源  
   **And** 本 story 不负责自动命中规则本身，也不负责后续低置信度 review
4. **Given** 创作者选择复用已有预设  
   **When** 创作者从可用预设中做出选择并确认  
   **Then** 系统必须将所选预设的默认规则应用到当前任务  
   **And** 当前任务必须明确记录这是一次手动选择已有预设继续的场景，而不是自动命中
5. **Given** 创作者选择创建新的最小频道预设  
   **When** 创作者填写最小必要字段并提交  
   **Then** 系统必须在不中断当前任务目标的前提下创建该预设  
   **And** 该新预设必须立即可作为当前任务的默认规则来源继续后续流程
6. **Given** 创作者选择不保存频道预设而继续当前任务  
   **When** 创作者确认继续  
   **Then** 系统必须允许该任务在没有频道预设资产沉淀的情况下继续  
   **And** 当前任务必须明确记录这是一次未使用预设继续的场景
7. **Given** 创作者处于陌生频道决策界面  
   **When** 页面呈现决策信息  
   **Then** 文案和交互必须强调这是一次轻量决策，而不是把用户拖入复杂配置后台  
   **And** 表单与配置暴露应限制在最小必要范围内
8. **Given** 创作者在该决策流程中输入无效信息或提交失败  
   **When** 系统执行校验或保存动作  
   **Then** 页面必须给出明确错误提示并保留当前决策上下文  
   **And** 创作者可以修正后继续，而不需要重新从任务导入入口开始
9. **Given** 陌生频道任务已经通过任一路径继续  
   **When** 后续系统、支持或运营模块读取任务信息  
   **Then** 必须能够区分该任务属于创建新预设后继续、手动复用已有预设继续或未使用预设继续  
   **And** 这些结果应成为后续解释和统计的正式状态来源

## Tasks / Subtasks

- [x] 扩展任务导入预览与确认数据模型，支持陌生频道人工决策上下文 (AC: 1, 2, 3, 6, 9)
  - [x] 将 `presetMatch` 从二元 `matched/none` 扩展为可表达 `manual_reuse`、`manual_create`、`continue_without_preset` 的正式任务上下文
  - [x] 为未命中场景生成可恢复的决策草稿数据，确保修正表单错误后不需要重新导入来源
  - [x] 保持已命中熟悉来源链路不回归，不把 2.3 的手动分流污染成新的自动命中规则
- [x] 在工作台任务导入界面落地陌生频道决策面板 (AC: 1, 2, 7, 8)
  - [x] 未命中预设时清楚展示“当前未命中现有预设”的状态说明
  - [x] 并列展示三条路径：复用已有预设、创建最小预设、直接继续
  - [x] 错误反馈以内联方式保留在当前决策上下文中，不把用户踢回导入起点
- [x] 支持手动复用已有预设继续当前任务 (AC: 3, 4, 8, 9)
  - [x] 允许从当前创作者已有预设中选择一个作为本次任务默认规则来源
  - [x] 确认创建任务时应用所选预设 baseline，并持久化“手动复用”语义而非“自动命中”
- [x] 支持创建最小频道预设并立即继续当前任务 (AC: 3, 5, 7, 8, 9)
  - [x] 复用 `channel-presets` 现有校验与 owner 约束，只暴露最小必要字段
  - [x] 预设创建成功后立即作为当前任务 baseline 来源，无需离开工作台或重新导入
- [x] 支持不保存预设直接继续当前任务 (AC: 3, 6, 8, 9)
  - [x] 在保留默认处理基线的前提下创建任务
  - [x] 将“未使用预设继续”写入任务快照和后续可读上下文
- [x] 补齐回归测试与任务可读性验证 (AC: 4, 5, 6, 8, 9)
  - [x] 覆盖三种分流路径的服务端确认结果、任务快照和错误恢复
  - [x] 覆盖工作台 action 分发与任务详情/摘要的可读语义
  - [x] 保持现有 `channel-presets`、`task-intake`、`task-query` 相关测试通过

### Review Follow-ups (AI)

- [x] [AI-Review][Critical] `confirm` / `confirm_manual_reuse` / `confirm_manual_create` 提交失败后，`preview` 会因为 `confirmFetcher.data.ok === false` 被直接清空，导致未命中预设说明、三路决策面板和当前导入上下文整体消失，未满足 AC8 要求的“明确错误提示并保留当前决策上下文”。`app/shared/ui/WorkspaceShell.tsx:230`
- [x] [AI-Review][Medium] 当前回归测试只验证 draft 没有被消费，没有覆盖工作台在确认失败后仍然保留预览与决策面板的前端行为，因此上面的 AC8 回归未被捕获。`tests/task-intake.test.ts:572`
- [x] [AI-Review][Medium] Story File List 漏记了本次实际新增的 `app/features/tasks/task-intake.shared.ts`，实现与文档追踪不完整。`_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md:123`

## Dev Notes

### Story Intent

- 本 story 是 Epic 2 中“陌生频道首次出现”的正式人工介入分支，只解决轻量决策与继续当前任务。
- 这里的人工介入只发生在预设未命中时，不扩展为复杂后台，也不引入 Story 2.4 的任务级字幕模板覆盖。
- 任务一旦通过任一路径继续，必须把决策语义冻结进当前任务上下文，供后续支持、运营和 story 复用。

### Architecture Compliance

- `tasks.preset_id` 与 `tasks.preset_snapshot` 仍是预设来源真源，但 `preset_snapshot` 需要能表达自动命中与手动决策的区别。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md]
- 未命中预设是产品定义中的正式分支，不是异常补丁；实现应横跨任务入口、前端交互、状态语义和审计上下文，而不是只做 UI 文案。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md]
- 核心流程保持 `preview -> confirm` 两段式，继续使用统一 request_id、任务快照与 owner-scoped 预设约束。

### UX Constraints

- 陌生频道决策面板必须并列展示三条路径，不设系统默认倾向，不通过视觉层级强推某一路径。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道决策面板]
- 交互重点是“轻量决策”，表单只暴露最小必要字段，避免把用户拉进复杂配置后台。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道复用或创建预设]
- 错误提示必须以内联上下文呈现，并保留用户当前决策状态。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md]

### Current Codebase State

- `app/features/tasks/server/task-intake.server.ts` 目前只支持 `matched/none` 两类 `presetMatch`，未命中时直接落回默认基线并单一路径确认。
- `app/shared/ui/WorkspaceShell.tsx` 已有来源识别卡、处理基线卡和命中预设卡，适合在未命中时扩展成陌生频道决策面板。
- `app/features/presets/server/channel-presets.server.ts` 已具备当前创作者视角的预设列表、创建、更新和按来源查找能力，可复用于“手动复用”和“最小预设创建”路径。
- `app/features/tasks/server/task-query.server.ts` 当前尚未把预设决策语义投影成任务详情可读信息，需要补充以满足 AC9。

### Testing Requirements

- 扩展 `tests/task-intake.test.ts`，覆盖三条人工决策路径、无效输入、草稿恢复和任务快照持久化。
- 必要时扩展 `tests/channel-presets.test.ts` 与 `tests/task-query.test.ts`，验证手动复用/新建预设后的可读语义。
- 完成后运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 61 tests.
- `pnpm build` passed.

### Completion Notes

- Expanded unknown-source preview from implicit fallback into explicit three-path preset resolution.
- Added manual reuse, inline minimal preset creation, and continue-without-preset flows on the shared workspace intake surface.
- Persisted preset decision semantics into task snapshots and surfaced readable preset context in task detail.

### File List

- `_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/presets/server/channel-presets.server.ts`
- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
- `app/features/tasks/components/TaskStatusSummaryCard.tsx`
- `app/features/tasks/task-intake.shared.ts`
- `app/features/tasks/server/task-errors.server.ts`
- `app/features/tasks/server/task-events.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `app/shared/ui/WorkspaceShell.tsx`
- `tests/task-intake.test.ts`
- `tests/task-query.test.ts`
- `tests/workspace-shell.test.ts`
- `tests/workspace-view.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-02

Findings:

- 已修复确认失败后 preview 丢失的问题，当前工作台会保留陌生频道决策上下文。`app/shared/ui/WorkspaceShell.tsx:196`
- 已补齐前端/服务端回归覆盖，锁定错误恢复与上下文保留行为。`tests/task-intake.test.ts:313`
- 已补齐 Story File List 的追踪缺口。`_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md:125`

Decision:

- Approve。前序 review follow-ups 已全部修复并验证通过，Story 状态更新为 `done`。

### Change Log

- 2026-06-02: Story artifact created from Epic 2 / Story 2.3 context.
- 2026-06-02: Implemented, reviewed, and completed unknown source manual resolution.
- 2026-06-02: BMAD review completed with Changes Requested; status reverted to in-progress and follow-up items added.
- 2026-06-02: Addressed AI review follow-ups for preview retention, regression coverage, and story file tracking; status returned to review.
- 2026-06-02: Review follow-ups verified as resolved; story marked done.
