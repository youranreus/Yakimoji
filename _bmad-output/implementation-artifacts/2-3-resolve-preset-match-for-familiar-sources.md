# Story 2.3: Resolve Preset Match for Familiar Sources

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 系统在识别到熟悉来源时解析并命中对应频道预设,
so that 我不需要每次重新确认同一套默认规则。

## Acceptance Criteria

1. **Given** 创作者已为某个来源频道维护了有效的频道预设  
   **When** 创作者导入来自该来源的新任务  
   **Then** 系统必须尝试基于识别到的来源信息自动匹配对应频道预设  
   **And** 匹配逻辑的结果必须能稳定用于任务默认值生成
2. **Given** 系统执行熟悉来源匹配  
   **When** 来源识别输入进入匹配规则  
   **Then** 匹配必须基于已定义的唯一来源标识输入  
   **And** 本 story 不负责定义复杂人工修正流程或未知来源补录分支
3. **Given** 系统成功命中某个频道预设  
   **When** 创作者查看任务创建确认区域  
   **Then** 页面必须明确标识该任务已命中已有频道预设  
   **And** 展示将被应用的关键规则摘要，包括默认翻译方向、默认字幕模板和默认输出偏好
4. **Given** 某个任务已命中频道预设  
   **When** 创作者确认继续创建任务  
   **Then** 系统必须以该预设生成任务默认值  
   **And** 创作者不需要重新逐项配置同一套默认规则
5. **Given** 系统成功命中某个频道预设  
   **When** 任务记录被创建并进入后续处理链路  
   **Then** 系统必须在任务元数据中保留命中的预设信息  
   **And** 明确标识该任务是命中已有预设而非新建预设或未使用预设
6. **Given** 同一来源有可稳定识别的熟悉频道  
   **When** 创作者多次导入该来源任务  
   **Then** 系统应在相同匹配条件下给出一致的命中结果  
   **And** 不得在没有原因说明的情况下随机切换是否命中预设
7. **Given** 预设在任务创建后被修改  
   **When** 后续系统读取该已创建任务  
   **Then** 该任务必须继续使用创建时已解析出的任务快照  
   **And** 不得因为预设后续更新而隐式改写已创建任务的默认值
8. **Given** 系统命中预设但相关默认值存在显示或应用失败  
   **When** 创作者查看确认界面或提交任务  
   **Then** 页面必须返回清楚的错误或降级提示  
   **And** 不得让用户误以为某套预设已经被完整应用而实际没有生效
9. **Given** 命中结果已产生  
   **When** 创作者、支持或后续运营模块读取该任务上下文  
   **Then** 系统必须能够区分该任务是命中已有预设、创建了新预设后继续还是未使用预设继续  
   **And** 这些状态应可作为后续支持解释和运营统计的基础

## Tasks / Subtasks

- [x] 先审计现有熟悉来源命中实现，再决定是否补差或仅收口故事边界 (AC: 1-9)
  - [x] 逐项核对 `app/features/tasks/server/task-intake.server.ts`、`app/shared/ui/WorkspaceShell.tsx`、`tests/task-intake.test.ts` 与本 story AC 的映射
  - [x] 明确哪些能力已在代码中存在、哪些仍是缺口，禁止在不了解现状的前提下重写一整套匹配逻辑
  - [x] 若实现已基本覆盖 AC，优先补齐命名、状态、测试或文档缺口，而不是重造流程

- [x] 在任务导入预览阶段执行 owner-scoped 频道预设匹配 (AC: 1, 2, 6)
  - [x] 使用来源识别产出的唯一 `sourceIdentifier` 查找当前创作者名下的频道预设
  - [x] 匹配必须基于精确标识，不做模糊匹配、跨用户复用或额外的人工修正规则
  - [x] 未命中时返回明确的 unresolved 结果，并把未知来源人工决策留给 `2.4`

- [x] 将命中结果反馈给任务创建确认区域 (AC: 3, 8)
  - [x] 在预览 payload 中返回结构化 `presetMatch`
  - [x] UI 必须明确展示“命中已有预设”状态、来源标识与规则摘要
  - [x] 若摘要显示失败或应用失败，返回清楚的错误或降级反馈，并保留 `request_id`

- [x] 在确认创建任务时应用并冻结预设默认值 (AC: 4, 5, 7, 9)
  - [x] 使用命中预设的 defaults 生成任务 `processingBaselineSnapshot`
  - [x] 将 `presetId` 与 `presetSnapshot` 写入任务记录，供任务详情、支持和运营读取
  - [x] 历史任务必须继续使用创建时快照，不得被后续预设编辑隐式改写

- [x] 维持自动命中、手动复用、手动新建、不保存预设四种语义边界 (AC: 5, 9)
  - [x] 自动命中使用 `matched`
  - [x] 手动复用使用 `manual_reuse`
  - [x] 手动新建使用 `manual_create`
  - [x] 未保存预设继续使用 `continue_without_preset`
  - [x] 避免把 `2.3` 的自动命中和 `2.4` 的人工决策状态混淆

- [x] 补齐或保留回归测试，覆盖熟悉来源命中与快照冻结语义 (AC: 1, 4, 5, 6, 7, 8, 9)
  - [x] 覆盖命中已有预设后的 preview baseline 与 confirm snapshot
  - [x] 覆盖任务级字幕模板覆盖只影响当前任务、不改写预设默认值
  - [x] 覆盖未命中 fallback，以及后续 `manual_reuse`、`manual_create`、`continue_without_preset` 与自动命中的区分

### Review Findings

- [x] [Review][Patch] 为错误态 `request_id` 渲染补上真实行为级回归覆盖，避免当前仅验证源码文本或 helper 输出 [`tests/e2e/workspace-shell.test.mjs`:26]
- [x] [Review][Patch] 从本次变更中移除生成产物 `tsconfig.vite.tsbuildinfo`，避免无意义 churn 和后续冲突 [`tsconfig.vite.tsbuildinfo`:1]

## Dev Notes

### Story Intent

- 本 story 的目标是“熟悉来源自动命中已有预设”，不是设计未知来源人工决策，也不是完整重做任务创建流程。
- 对开发代理最重要的事实：当前仓库中已经存在大量与本 story 高度重合的实现与测试。进入编码前必须先审计现状，否则极易重复开发或把 `2.3` 与 `2.4` 边界写乱。

### Epic and Cross-story Context

- Epic 2 的顺序是：`2.1` 建立预设列表与最小创建入口，`2.2` 建立详情/编辑/预览，`2.3` 处理熟悉来源自动命中，`2.4` 处理未知来源人工决策，`2.5` 处理任务级字幕模板覆盖。
- `2.3` 只处理自动命中的 happy path 和必要的错误/降级语义；未知来源三选一路径必须交给 `2.4`，不要把两个 story 合并实现。
- 当前仓库存在一个历史误编号文档 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-resolve-preset-match-for-familiar-sources.md`。它的内容实际描述的就是当前 `2.3`。开发时必须以当前 `epics.md` 与 `sprint-status.yaml` 为准，而不是沿用这个旧编号判断 story 身份。

### Previous Story Intelligence

- `2.2` 已经把预设维护边界收口到 `presets` 路由族，并强调任务级模板覆盖与预设默认模板是两层概念。
- `2.3` 必须复用 `2.2` 产出的预设读模型与 owner-scoped 查询能力，不能重新发明第二套 preset service 或第二套字段语义。
- `2.2` 的实现还明确引入了 preview style metadata，但这些样式字段不属于任务 baseline。`2.3` 在快照中只应保留任务创建所需 defaults 与 preset context，不应把预览样式误写入处理基线。

### Current Codebase State

- `app/features/tasks/server/task-intake.server.ts`
  - 当前已经存在 `findChannelPresetForSource`、`buildResolvedPresetMatch`、`confirmTaskCreation`、`presetSnapshot` 与 `processingBaselineSnapshot` 相关逻辑。
  - 本 story 需要先核对这里是否已完整满足 AC，而不是假设尚未实现。
  - 必须保留：preview -> confirm 的两段式草稿流程、`request_id`、任务快照冻结语义。

- `app/shared/ui/WorkspaceShell.tsx`
  - 当前已经为 `matched`、`manual_reuse`、`manual_create`、`continue_without_preset`、`unresolved` 提供不同展示文案与提交流程。
  - 自动命中分支已经展示命中摘要并支持“确认并创建任务”；未命中分支已引向 `2.4` 需要的人工决策 UI。
  - 必须保留：自动命中分支的轻确认体验，不能把它重新扩展回大表单。

- `app/routes/workspace.tsx`
  - 当前任务导入 action 统一通过 `handleTaskIntakeAction` 进入。
  - 本 story 不应新建平行的任务创建路由或绕过现有 workspace action。

- `app/features/presets/server/channel-presets.server.ts`
  - 当前已提供 `findChannelPresetForSource`、`getChannelPresetByIdForUser` 等 owner-scoped 能力。
  - 本 story 应直接复用这些能力，不要复制匹配逻辑到 tasks 层。

- `database/schema/tasks.ts` 与 `drizzle/0007_channel_preset_workbench.sql`
  - 当前任务表已具备 `preset_id` 与 `preset_snapshot`。
  - 本 story 应复用这些字段表达命中结果，而不是额外增加一套平行存储。

- `tests/task-intake.test.ts`
  - 当前已覆盖 matched、manual_reuse、manual_create、continue_without_preset、subtitle override 等核心分支。
  - 本 story 实施时必须先读懂这些测试，它们基本就是当前行为真相。

### Architecture Compliance

- 预设匹配必须遵循 owner scope。匹配键是创作者身份 + 唯一来源标识，而不是全局共享或模糊搜索。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Architecture`]
- 任务状态与上下文字段必须继续使用统一状态模型与结构化快照，不新增第二套同义枚举。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Task-Status-Model`]
- 错误语义必须带统一 envelope 与 `request_id`，使支持排障、SSE、任务详情和 API 合约保持一致。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error-Handling-Standard`]
- 前端应继续走 route-driven 的 action / loader 模式，不要为了命中逻辑另建客户端私有状态机。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#SSE-Integration-Strategy`]

### UX Guardrails

- 命中确认卡应让用户一眼确认“来源已识别、预设已命中、将按这套规则开跑”，而不是再次打开完整配置表单。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#熟悉频道自动开跑`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#预设命中确认卡`]
- 自动命中路径的目标是低摩擦确认；未知来源才进入轻量三选一决策面板。这两个 UX 路径必须明确分开。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道复用或创建预设`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#陌生频道决策面板`]
- 任务创建页面可以支持任务级模板覆盖，但完整预设编辑仍属于 `presets` 路由族，不应回流到本 story。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Task-Create-页面-/-可寻址弹窗`]

### Data Model and Integration Guidance

- `presetMatch` 需要区分至少五种状态：`matched`、`unresolved`、`manual_reuse`、`manual_create`、`continue_without_preset`。
- 只有 `matched` 属于本 story 的主目标；后三种状态属于 `2.4` 及后续流程，但其状态语义必须在本 story 上下文里说明清楚，因为任务元数据和运营统计要统一读取。
- `processingBaselineSnapshot` 只保存处理所需默认值，不包含 preview style 等 UI-only metadata。
- `presetSnapshot` 才是任务层面的预设上下文真源，用于后续任务详情、支持解释、运营分类和审计。

### Existing Implementation Signals

- `tests/task-intake.test.ts` 已覆盖：
  - 熟悉来源命中已有预设后的 preview 与 confirm
  - 命中预设后的任务级字幕模板覆盖
  - 手动复用已有预设
  - 新建最小预设后继续
  - 不保存预设继续
- `app/shared/ui/WorkspaceShell.tsx` 已呈现：
  - 命中已有预设的确认卡
  - 未命中后的三路决策面板
  - 创建成功后的 preset context summary
- 直接结论：dev agent 在实现本 story 时，第一步应是判断“是否需要补齐缺口”，而不是默认“从零开发”。

### Recommended Implementation Sequence

1. 先核对 `2-2-resolve-preset-match-for-familiar-sources.md` 与当前正确 story 编号 `2-3` 的差异，确认需要保留的实现事实。
2. 审计 `task-intake.server.ts` 的 matched 分支，检查是否完整满足 AC 1-9。
3. 审计 `WorkspaceShell.tsx` 命中确认卡，确认展示字段与错误反馈是否对齐 AC 3 和 AC 8。
4. 审计 `presetSnapshot` / `processingBaselineSnapshot` 的持久化，确认满足 AC 5、7、9。
5. 只在存在真实差距时补代码；否则优先补文档、测试、状态同步或命名修正。

### Implementation Guardrails

- 不要重写 `findChannelPresetForSource` 的 owner-scoped 精确匹配为模糊或全局匹配。
- 不要把 `2.4` 的人工决策逻辑当成 `2.3` 自动命中的一部分来重构。
- 不要新增第二套任务快照字段或第二套 preset resolution 枚举。
- 不要把预设 preview style 写进任务处理 baseline。
- 不要因为预设后来被编辑就回写历史任务记录。
- 不要忽略已经存在的测试，尤其是 matched 与 manual 分支的状态差异。

### Testing Requirements

- 必须至少验证以下测试仍成立：
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/channel-presets.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-view.test.ts`
- 若补代码，优先增加针对以下行为的测试：
  - matched 分支的稳定摘要输出
  - `presetSnapshot` 与 `processingBaselineSnapshot` 的职责分离
  - 预设编辑后新任务使用新默认值、旧任务继续保留旧快照
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`

### Git Intelligence Summary

- 最近相关提交包含：
  - `feat: add preset detail and edit flows`
  - `feat: add dedicated preset routes`
  - `chore: update sprint status for preset stories`
- 这些提交说明 Epic 2 的预设与任务创建链路已经连续推进过几轮，真实风险不是“没有实现”，而是“story 状态台账与代码现实偏离”。

### Latest Technical Information

- React Router 官方当前最新文档页面将 Framework Mode Data Loading 标记为 `latest` `7.17.0`，继续强调 `loader` 负责 route 级数据加载，且 server loader 逻辑不会进入 client bundle。这支持当前继续把任务导入与预设命中放在 route/action + server helper 中，而不是做纯客户端命中逻辑。[Source: https://reactrouter.com/start/framework/data-loading]
- Zod 官方首页当前明确写明 “Zod 4 is now stable”，而仓库已使用 `zod@^4.4.3`。因此表单与 action 校验应继续基于 Zod v4，而不是再引入新的 schema 系统。[Source: https://zod.dev/]
- React Hook Form 官方 README 当前继续将其定位为性能优先、兼容 schema resolver 的表单库。仓库已使用 `react-hook-form@7.76.1` 与 `@hookform/resolvers`，因此任务级覆盖或后续人工决策表单如需扩展，应优先走现有 RHF + resolver 组合。[Source: https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/README.md]
- 当前仓库 `package.json` 固定使用 `react-router@7.14.0`、`react-hook-form@7.76.1`、`zod@^4.4.3`。本 story 不应混入框架升级。

### Project Context Reference

- workflow `persistent_facts` 里要求加载的 `project-context.md` 在当前仓库中未找到匹配文件。
- 本 story 实际依赖的上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-preset-detail-editing-and-subtitle-preview.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-resolve-preset-match-for-familiar-sources.md`（仅作历史情报）

### Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story file intentionally records that substantial implementation signals already exist in codebase, so the dev agent must audit before changing code.

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.3:-Resolve-Preset-Match-for-Familiar-Sources`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md#Channel-Preset-Management`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Task-Status-Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error-Handling-Standard`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#熟悉频道自动开跑`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#预设命中确认卡`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/shared/ui/WorkspaceShell.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /Users/reuszeng/Code/Projects/Yakimoji/_bmad/scripts/resolve_customization.py --skill /Users/reuszeng/Code/Projects/Yakimoji/.agents/skills/bmad-create-story --key workflow`
- `cat /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sed -n '514,716p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
- `sed -n '252,303p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
- `sed -n '338,571p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
- `sed -n '528,720p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
- `sed -n '931,1455p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
- `git log --oneline -5`
- `sed -n '1,1080p' /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts`
- `sed -n '1,520p' /Users/reuszeng/Code/Projects/Yakimoji/app/features/presets/server/channel-presets.server.ts`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/app/routes/workspace.tsx`
- `sed -n '520,820p' /Users/reuszeng/Code/Projects/Yakimoji/app/shared/ui/WorkspaceShell.tsx`
- `sed -n '1,860p' /Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
- `sed -n '1,360p' /Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-view.test.ts`
- `sed -n '1,360p' /Users/reuszeng/Code/Projects/Yakimoji/tests/channel-presets.test.ts`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-shell.test.ts`
- `sed -n '1,220p' /Users/reuszeng/Code/Projects/Yakimoji/tests/e2e/workspace-shell.test.mjs`
- `pnpm test`
- `pnpm typecheck`

### Completion Notes List

- 完成现状审计，确认 owner-scoped 预设命中、快照冻结和四种预设语义边界已由现有实现覆盖
- 修正创作者工作台的错误反馈，在命中摘要显示或应用失败时显式展示 `request_id`，满足 AC 8 的可追踪降级要求
- 新增 `getInlineErrorRequestId` 回归测试，并更新 workspace shell 文案回归测试，防止后续移除错误追踪信息
- 运行 `pnpm test` 与 `pnpm typecheck`，确认 story 相关实现与全量回归均通过

### File List

- `_bmad-output/implementation-artifacts/2-3-resolve-preset-match-for-familiar-sources.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/shared/ui/WorkspaceShell.tsx`
- `tests/workspace-shell.test.ts`
- `tests/e2e/workspace-shell.test.mjs`
- `tsconfig.vite.tsbuildinfo`

### Change Log

- 2026-06-16: 审计并收口 Story 2.3 的现有实现，补充创作者内联错误中的 `request_id` 展示与对应回归测试，确认预设命中与快照冻结语义满足验收标准
