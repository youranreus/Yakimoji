# Story 2.4: Unknown Source Manual Resolution

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

- [x] 先审计现有未知来源分支与 story 编号漂移，再决定补差还是只做编号收口 (AC: 1-9)
  - [x] 对照 `epics.md`、`sprint-status.yaml` 与现有实现产物，确认当前正式故事编号是 `2.4`
  - [x] 审计现有代码与历史产物里是否已经存在未知来源人工决策实现，避免重复开发
  - [x] 若功能大体已存在，优先补齐状态同步、文档、测试或残缺边界，而不是重做一套流程
- [x] 扩展任务导入预览与确认数据模型，支持陌生频道人工决策上下文 (AC: 1, 2, 3, 6, 9)
  - [x] 将 `presetMatch` 保持为可表达 `unresolved`、`manual_reuse`、`manual_create`、`continue_without_preset` 的正式任务上下文
  - [x] 为未命中场景生成可恢复的决策草稿数据，确保修正表单错误后不需要重新导入来源
  - [x] 保持已命中熟悉来源链路不回归，不把 `2.3` 的自动命中流程污染成新的人工分支
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

### Review Findings

- [x] [Review][Patch] 编号收口未同步 `2.5` 状态，`sprint-status.yaml` 仍将 `2-5-task-level-subtitle-template-override-on-top-of-presets` 标为 `backlog` [/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml:59]
- [x] [Review][Patch] `File List` 把未在本次 diff 中变更的源码与测试文件写成了本次变更文件 [/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-4-unknown-source-manual-resolution.md:263]
- [x] [Review][Patch] story 工件把未知来源三路决策的 AC2/AC9 满足情况写成已验证事实，但当前 UI 与回归覆盖不足以支撑这一结论 [/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-4-unknown-source-manual-resolution.md:259]

## Dev Notes

### Story Intent

- 本 story 是 Epic 2 中“陌生频道首次出现”的正式人工介入分支，只解决轻量决策与继续当前任务。
- 这里的人工介入只发生在预设未命中时，不扩展为复杂后台，也不引入低置信度 review 逻辑。
- 任务一旦通过任一路径继续，必须把决策语义冻结进当前任务上下文，供后续支持、运营和后续 story 复用。

### Epic and Cross-story Context

- Epic 2 的顺序是：`2.1` 预设列表与最小创建入口，`2.2` 预设详情/编辑/预览，`2.3` 熟悉来源自动命中，`2.4` 未知来源人工决策，`2.5` 任务级字幕模板覆盖。
- `2.4` 依赖 `2.3` 已经提供来源识别、owner-scoped preset lookup 与命中成功路径，但必须清楚保持边界，不把自动命中与人工决策揉成一个模糊分支。
- 当前仓库存在编号漂移：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md` 的内容实际描述的就是当前 `2.4`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-4-task-level-subtitle-template-override-on-top-of-presets.md` 的内容实际描述的是当前 `2.5`
- 开发时必须以当前 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md` 和 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml` 的正式编号为准。

### Previous Story Intelligence

- `2.2` 已经把预设维护收口到 `presets` 路由族，并建立 owner-scoped 预设读写能力与轻量预览风格元数据。
- `2.3` 已经把熟悉来源自动命中、任务快照冻结与命中摘要展示打通。`2.4` 必须在此基础上补未命中分支，而不是另建一套任务创建栈。
- `2.5` 的任务级字幕模板覆盖只应建立在有预设支撑的路径之上，不能提前混进 `2.4` 的 continue-without-preset 路径。

### Current Codebase State

- `app/features/tasks/server/task-intake.server.ts`
  - 当前已经存在 `buildResolvedPresetMatch`、`buildManualPresetMatch`、`buildContinueWithoutPresetMatch` 与 `confirmTaskCreation` 等核心逻辑。
  - 从现有代码与历史产物看，未知来源人工决策能力很可能已经实现过一轮；本 story 的第一步必须是审计真实现状，而不是默认从零开发。
  - 必须保留：`preview -> confirm` 两段式草稿流程、`request_id`、任务快照冻结语义。
- `app/shared/ui/WorkspaceShell.tsx`
  - 当前已经为 `unresolved` 展示“需要选择预设”的决策区，并提供 `confirm_manual_reuse`、`confirm_manual_create`、`confirm_continue_without_preset` 三个提交流程。
  - 必须保留三路并列决策与内联错误反馈，避免把用户打回导入起点。
- `app/features/presets/server/channel-presets.server.ts`
  - 当前已提供 `listChannelPresetsForCurrentUser`、`findChannelPresetForSource`、`getChannelPresetByIdForUser`、`createChannelPreset` 等 owner-scoped 能力。
  - `2.4` 必须复用这些能力，不要复制一套新 preset service。
- `app/features/tasks/server/task-query.server.ts` 与 `app/features/tasks/components/TaskStatusSummaryCard.tsx`
  - 任务详情与摘要已经支持手动复用、新建预设继续、未保存预设继续三种语义；本次 review 额外补了读取侧回归覆盖，避免只验证写入不验证投影。
- `tests/task-intake.test.ts`
  - 当前已包含任务导入、草稿、确认与错误恢复的高价值覆盖。
  - 进入编码前必须先读懂既有测试，因为它们已经定义了当前行为真相。

### Architecture Compliance

- 未命中预设、陌生频道决策与低置信度确认是产品定义中的正式分支，不是异常补丁；它们要贯穿任务入口、规则系统、状态机、前端交互和审计记录。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`]
- `tasks.preset_id` 与 `tasks.preset_snapshot` 仍是预设来源真源，但 `preset_snapshot` 需要能表达自动命中与手动决策的区别。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`]
- 核心流程保持 `preview -> confirm` 两段式，继续使用统一 `request_id`、任务快照与 owner-scoped 预设约束。
- 任务详情、支持视图和后续运营统计必须读取同一套 `presetMatch` 语义，不能另发明平行字段或第二套枚举。

### UX Guardrails

- 未命中预设时，系统不应把用户拉入复杂后台，而应提供足够轻的决策路径，让用户快速决定复用已有预设、创建最小预设，或者不保存预设继续当前任务。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道复用或创建预设`]
- 陌生频道决策面板必须并列展示三条路径，不设系统默认倾向，不通过视觉层级强推某一路径。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道决策面板`]
- 错误提示必须以内联上下文展示，且保留用户当前的导入与决策上下文。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`]

### Data Model and Integration Guidance

- `presetMatch` 至少要稳定表达五种状态：`matched`、`unresolved`、`manual_reuse`、`manual_create`、`continue_without_preset`。
- `2.4` 的核心是把 `unresolved` 推进到后三种人工决策结果之一，并把它们冻结进任务记录与可读摘要。
- `processingBaselineSnapshot` 只保存后续处理所需默认值；`presetSnapshot` 才是任务层面的预设上下文真源。
- `continue_without_preset` 必须明确代表“不沉淀预设资产但继续当前任务”，而不是隐藏的自动命中或非法覆盖分支。

### Existing Implementation Signals

- 代码层已经出现以下高相关信号：
  - `confirm_manual_reuse`
  - `confirm_manual_create`
  - `confirm_continue_without_preset`
  - `buildManualPresetMatch`
  - `buildContinueWithoutPresetMatch`
- 历史实现产物 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md` 记录了一轮已完成的未知来源分支实现与 review 结果。
- 直接结论：dev agent 的第一步必须是判断“正式编号与当前代码现实是否已对齐”，而不是盲目重写功能。

### Recommended Implementation Sequence

1. 审计 `epics.md`、`sprint-status.yaml`、现有 `2-3-unknown-source-manual-resolution.md` 与代码现实，确认需要补的是“正式编号与状态同步”还是“真实实现缺口”。
2. 审计 `task-intake.server.ts` 中 `unresolved -> manual_* / continue_without_preset` 的确认分支，确认是否满足 AC 1-9。
3. 审计 `WorkspaceShell.tsx` 的陌生频道决策面板，确认三路并列展示与错误保留语义是否完整。
4. 审计 `task-query.server.ts` / `TaskStatusSummaryCard.tsx`，确认三类人工决策结果是否被支持和运营视角正确读取。
5. 只在存在真实缺口时补代码；若能力已在代码中存在，则优先修正台账、测试、文档或残留边界。

### Implementation Guardrails

- 不要把 `2.3` 的自动命中逻辑重构成需要用户多做一步人工确认的复杂流程。
- 不要复制一套新的 preset 服务或新的 task intake 路由。
- 不要把未知来源决策混同为失败补丁；它是正式产品分支。
- 不要让确认失败清空 preview 与决策上下文。
- 不要在 `continue_without_preset` 路径里偷偷引入只有 preset-backed 路径才允许的任务级覆盖能力。
- 不要忽略现有实现和历史 story 产物，否则极易重复开发。

### Testing Requirements

- 必须至少验证以下测试仍成立：
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-query.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-shell.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-view.test.ts`
- 若补代码，优先增加针对以下行为的测试：
  - 确认失败后 preview 与三路决策面板仍保留
  - `manual_reuse` / `manual_create` / `continue_without_preset` 的任务快照语义区分
  - 任务详情和摘要对三种人工决策结果的可读投影
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`

### Git Intelligence Summary

- 最近相关提交包含：
  - `fix: harden workspace request id review follow-up`
  - `fix: surface preset match request ids in workspace`
  - `chore: update sprint status for preset stories`
  - `feat: add preset detail and edit flows`
  - `feat: add dedicated preset routes`
- 这些提交说明 Epic 2 的预设链路已经连续推进过多轮，真实风险仍然是“story 编号、产物和代码现实不一致”，不是“完全没有实现”。

### Latest Technical Information

- React Router 官方当前文档在 2026-06-20 显示 `latest` 为 `8.0.1`，并继续强调 Framework Mode 中 `loader` 负责服务端数据加载，且 `loader` 不会进入 client bundle。结合仓库当前 `package.json` 固定的 `react-router@7.14.0`，本 story 应继续沿用现有 route/action + server helper 模式，不引入框架升级或纯客户端命中逻辑。[Source: https://reactrouter.com/start/framework/data-loading, `/Users/reuszeng/Code/Projects/Yakimoji/package.json`]
- Zod 官方首页当前明确写明 `Zod 4 is stable`，并要求 TypeScript `strict` 模式；仓库当前使用 `zod@^4.4.3`，因此表单与服务端校验应继续基于现有 Zod v4 真源，而不是引入第二套 schema 系统。[Source: https://zod.dev/, `/Users/reuszeng/Code/Projects/Yakimoji/package.json`]
- React Hook Form 官方 README 继续强调它以 performance、UX、DX 为核心，并直接支持 Zod resolver；仓库当前已经使用 `react-hook-form@7.76.1` 与 `@hookform/resolvers`，因此未知来源决策表单如需补差，应优先复用 RHF + Zod resolver 组合。[Source: https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/README.md, `/Users/reuszeng/Code/Projects/Yakimoji/package.json`]

### Project Context Reference

- workflow `persistent_facts` 要求加载的 `project-context.md` 在当前仓库中未找到匹配文件。
- 本 story 实际依赖的上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-preset-detail-editing-and-subtitle-preview.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-3-resolve-preset-match-for-familiar-sources.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md`（仅作历史情报，正式编号以本 story 为准）

### Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story file intentionally records the numbering drift and existing implementation signals so the dev agent audits reality before making code changes.

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.4:-Unknown-Source-Manual-Resolution`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md#Review-&-Exception-Handling`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道复用或创建预设`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道决策面板`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/shared/ui/WorkspaceShell.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /Users/reuszeng/Code/Projects/Yakimoji/_bmad/scripts/resolve_customization.py --skill /Users/reuszeng/Code/Projects/Yakimoji/.agents/skills/bmad-create-story --key workflow`
- `sed -n '605,716p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
- `sed -n '252,290p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
- `sed -n '90,130p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
- `sed -n '359,470p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
- `git log -5 --oneline`
- `codegraph_explore confirmTaskCreation buildResolvedPresetMatch resolveWorkspacePreview findChannelPresetForSource TaskStatusSummaryCard task-query manual_reuse manual_create continue_without_preset`
- `open https://reactrouter.com/start/framework/data-loading`
- `open https://zod.dev/`
- `open https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/README.md`
- `python3 /Users/reuszeng/Code/Projects/Yakimoji/_bmad/scripts/resolve_customization.py --skill /Users/reuszeng/Code/Projects/Yakimoji/.agents/skills/bmad-dev-story --key workflow`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-4-unknown-source-manual-resolution.md`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-3-unknown-source-manual-resolution.md`
- `rg -n "manual_reuse|manual_create|continue_without_preset|unresolved|confirm_manual_reuse|confirm_manual_create|confirm_continue_without_preset" /Users/reuszeng/Code/Projects/Yakimoji/app /Users/reuszeng/Code/Projects/Yakimoji/tests`
- `pnpm typecheck`
- `pnpm test`

### Completion Notes List

- Created the formal `2.4` story artifact under the current epic numbering.
- Captured the existing numbering drift between historical implementation artifacts and the current planning documents.
- Documented that the dev agent should audit current code reality before making functional changes.
- Audited the current repository and confirmed the unknown-source manual resolution flow already exists end-to-end under the historical `2.3` implementation lineage.
- Verified that current code already implements the `unresolved`、`manual_reuse`、`manual_create`、`continue_without_preset` task semantics from the historical `2.3` lineage, then tightened the remaining review gaps around UI neutrality, read-side regression coverage, and artifact tracking.
- Re-ran `pnpm typecheck` and `pnpm test` on 2026-06-20 after closing the numbering/status drift and the review follow-up gaps above.

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-4-unknown-source-manual-resolution.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/shared/ui/WorkspaceShell.tsx`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-query.test.ts`

### Change Log

- 2026-06-20: Audited the existing unknown-source manual resolution implementation, confirmed the historical `2.3` numbering drift, and updated this story to reflect the validated `2.4` status.
- 2026-06-20: Addressed code-review follow-ups by syncing the `2.5` sprint status, correcting the story file list, flattening unknown-source decision CTA emphasis, and adding read-side regression coverage for `manual_create` / `continue_without_preset`.
