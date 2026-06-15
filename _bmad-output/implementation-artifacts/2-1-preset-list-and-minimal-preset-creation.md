# Story 2.1: Preset List and Minimal Preset Creation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 查看已有频道预设并创建新的最小预设,
so that 我能先建立可复用资产，再让后续任务自动带出默认规则。

## Acceptance Criteria

1. **Given** 创作者已登录并进入预设管理入口  
   **When** 页面加载  
   **Then** 系统必须提供独立的预设列表视图或可寻址状态  
   **And** 创作者可以查看自己已维护的频道预设摘要信息
2. **Given** 创作者需要为一个来源频道建立预设  
   **When** 创作者发起创建预设动作  
   **Then** 系统必须允许其进入独立的预设创建流程  
   **And** 创建流程至少支持填写来源频道标识、默认翻译方向、默认字幕模板和默认输出偏好
3. **Given** 创作者提交有效的新预设配置  
   **When** 系统保存成功  
   **Then** 该预设必须与当前创作者归属关联  
   **And** 保存后的预设必须能在预设列表中再次查看和后续复用
4. **Given** 创作者提交的预设信息不完整或无效  
   **When** 系统执行校验  
   **Then** 页面必须返回明确的字段级或表单级错误提示  
   **And** 错误反馈必须支持用户修正后再次提交，而不是让预设进入不确定状态
5. **Given** 创作者在桌面端使用预设创建流程  
   **When** 页面渲染表单  
   **Then** 该流程必须遵循渐进暴露与轻量配置原则  
   **And** 不得扩展成复杂翻译风格编辑器或超出已确认范围的高级参数后台
6. **Given** 创作者访问他人预设或无权限的预设资源  
   **When** 系统执行授权检查  
   **Then** 系统必须拒绝越权访问  
   **And** 只有预设拥有者或具备相应内部权限的角色才能查看对应预设摘要或创建相关资源

## Tasks / Subtasks

- [x] 对齐当前实现与新规划边界，复用已有预设基础能力而不是重建 (AC: 1, 2, 3, 4, 6)
  - [x] 复查 `database/schema/channel-presets.ts`、`app/features/presets/server/channel-presets.server.ts` 与 `tests/channel-presets.test.ts`，确认现有 owner 归属、唯一约束、字段校验与 source lookup 能直接作为 Epic 2 后续故事的基础
  - [x] 把本次 story 的目标限定为“独立列表 + 独立最小创建”，不要重复落地已存在的数据模型、持久化契约或 source match helper
  - [x] 明确记录当前仓库里旧版 `2-1-create-and-manage-channel-presets.md` 对应实现已覆盖了编辑能力；本次实现若需调整，应以收敛范围和路由归属为目标，而不是删除已验证的基础能力

- [x] 为预设资产建立独立的路由入口与最小创建流程 (AC: 1, 2, 3, 5, 6)
  - [x] 在 `app/routes.ts` 注册 `presets` 路由族，至少覆盖 `/presets` 与 `/presets/new`
  - [x] 新增对应 route module，使预设列表 loader 与预设创建 action 归属 `presets` 路由族，而不是继续完全挂在 `/workspace` action 上
  - [x] 允许 `workspace` 保留预设预览和入口，但完整列表与最小创建必须具备独立 URL 或等价可寻址状态

- [x] 落地“轻量列表 + 最小创建”界面，不把 2.2 的详情/编辑范围提前做穿 (AC: 1, 2, 4, 5)
  - [x] 在 `app/features/presets/components/` 中拆分列表与创建组件，形成适合 `/presets` 与 `/presets/new` 的页面级组合
  - [x] 列表只展示摘要信息：预设名称、来源频道、默认翻译方向、字幕模板摘要、输出偏好与必要的时间信息
  - [x] 创建页只承载最小必填字段和 inline 错误反馈，不在本 story 新增字幕样式高级配置、模拟播放器预览或完整编辑体验
  - [x] 若当前 `ChannelPresetWorkbench` 中存在内联更新表单，应避免继续扩张该模式；2.2 才是详情/编辑/预览的正式承接故事

- [x] 维持授权、错误语义和后续故事兼容性 (AC: 3, 4, 6)
  - [x] 继续复用现有 request context、session、RBAC 与结构化错误返回，不新增平行鉴权逻辑
  - [x] 保证 `findChannelPresetForSource`、列表读取与创建成功结果契约不被破坏，以便 2.3 熟悉来源自动命中故事直接消费
  - [x] 错误反馈继续支持字段级映射，确保复杂表单升级到 2.2 时不需要推翻当前 action contract

- [x] 补齐针对新 IA 的回归测试 (AC: 1, 2, 3, 4, 6)
  - [x] 为新增的 `presets` 路由补充 loader/action 测试，覆盖已登录 creator 访问、越权拒绝、创建成功、字段错误和列表展示
  - [x] 更新现有 workspace 相关测试，确认工作台仍保留预设入口/摘要，但不再承担完整预设管理真入口
  - [x] 保持 `tests/channel-presets.test.ts`、`tests/workspace-view.test.ts`、`pnpm typecheck` 与 `pnpm test` 通过

## Dev Notes

### Story Intent

- 这是更新后 Epic 2 的“预设资产入口”故事，不再等同于旧规划里的“创建 + 查看 + 编辑一把做完”。
- 目标是把频道预设从 workspace 内联区抬升为独立的核心对象入口，让后续 `2.2` 的详情/编辑/字幕预览，以及 `2.3` 的自动命中逻辑有清晰边界。
- 这不是一次从零开始的 CRUD 故事。仓库已经存在一版更宽范围的预设基础实现；本次 story 的关键是识别哪些能力应该直接复用，哪些 UI/路由归属需要重新收口到当前规划。

### Business and Planning Context

- Epic 2 的产品承诺已经从“有预设功能”细化为“先建立可复用资产，再让任务自动带出默认规则”。`2.1` 负责先把资产入口和最小创建走通；`2.2` 才负责详情、编辑和字幕样式预览；`2.3` 再负责熟悉来源自动命中。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Epic-2:-Channel-Preset-Workbench-and-Smart-Task-Launch`]
- 当前 `sprint-status.yaml` 已把目标 story key 定义为 `2-1-preset-list-and-minimal-preset-creation`，而仓库里已有历史实现文档 `2-1-create-and-manage-channel-presets.md`。这不是同一个范围，开发时必须显式区分，避免误以为“2-1 已经完成所以无需处理”或“重做一套重复实现”。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-1-create-and-manage-channel-presets.md`]
- 结论：本 story 应把旧版 2-1 当作现有实现情报，而不是当作当前规划的真范围。

### Historical Artifact Intelligence

- 旧版 `2-1-create-and-manage-channel-presets.md` 已经交付了：
  - `channel_presets` 数据模型、唯一约束和 owner 归属
  - `features/presets/server/channel-presets.server.ts` 中的 list/create/update/find-by-source 领域服务
  - 工作台里的预设列表、创建与内联编辑表单
  - `tests/channel-presets.test.ts`、`tests/workspace-view.test.ts` 等回归基线
- 这些基础能力不应在本 story 被重新造一遍。当前规划下真正缺的是：
  - 预设路由边界
  - 独立列表/独立创建入口
  - 对 2.2 编辑范围的明确隔离
- 如果开发代理忽略这层历史上下文，最常见的失败会是：
  - 重建重复 schema / service
  - 继续把编辑能力堆在 workspace 内联表单里
  - 因为“要实现新故事”而破坏 `findChannelPresetForSource` 等后续故事依赖的稳定基础

### Git Intelligence Summary

- 最近 5 个提交标题分别为：
  - `dcdac03 docs: refine sprint status for new story identities`
  - `58fcbd7 docs: realign planning artifacts and sprint status`
  - `3395bf8 docs: correct epics readiness artifacts`
  - `fb19184 docs: correct product IA and preset editing planning`
  - `5e8a225 feat: add minimum task audit record view`
- 这些提交说明当前仓库正处于“规划重整、story 命名纠偏、IA 重划”的阶段。对 `2.1` 来说，这意味着重点是按最新 IA 收口实现边界，而不是继续沿旧 story 名称机械扩展功能。
- 近期没有新的预设功能代码提交，说明开发实现基础主要来自更早的旧版 `2-1`；本次 story 应在此之上做结构对齐。

### Architecture Compliance

- 架构已明确登录后应用必须围绕 `workspace`、`tasks`、`presets`、`review`、`deliverables/results` 建立清晰路由边界；`workspace` 只负责总览与入口，不承载完整预设编辑或预设更新 action。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Frontend-implication`]
- 预设相关 loader/action 必须归属 `presets` 路由族，`workspace` loader 只能加载总览摘要数据，不应继续承担完整预设管理真入口。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`]
- 代码组织应保持 domain-first：预设领域逻辑放在 `features/presets/`，不要把 preset helper 扔进 `shared/utils` 或在 route 里散落业务逻辑。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Component-and-Route-Architecture`]
- 数据命名继续遵守既定规则：数据库使用 `snake_case`，API 与 TypeScript 层使用 `camelCase`，REST 资源名使用 `channel-presets`。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns`]

### UX and Interaction Guardrails

- UX 文档已把 `Preset List`、`Preset Detail`、`Preset Edit` 定义为分离页面职责：列表负责展示资产和创建入口；详情负责只读确认；编辑负责配置与预览。本 story 只实现列表和最小创建，不能提前把详情/编辑职责再次揉回一个内联面板。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-List-页面`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Detail-页面-/-可寻址弹窗`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Edit-页面-/-可寻址弹窗`]
- 创建流程必须遵循渐进暴露和轻量配置原则，目标是让用户先建立资产，而不是马上进入复杂字幕编辑器。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.1:-Preset-List-and-Minimal-Preset-Creation`]
- `workspace` 页面约束已经写明：它只作为总览和入口，不展开完整预设编辑表单或复杂异常处理流程。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Workspace-Overview-页面`]

### Current Codebase State and Files to Update

- `app/routes.ts`
  - 当前状态：只有 `workspace`、task detail、deliverable、operations 等路由，没有 `presets` 路由族。
  - 本 story 要改：新增 `/presets` 与 `/presets/new` 路由注册。
  - 必须保留：现有任务、交付物与 workspace 路由组织风格。

- `app/routes/workspace.tsx`
  - 当前状态：`action` 同时分发任务导入和预设 create/update，预设能力仍完全附着在 workspace。
  - 本 story 要改：把完整预设创建入口迁移到 `presets` 路由族；workspace 保留预设预览和入口即可。
  - 必须保留：creator 鉴权边界、任务导入入口和现有错误边界模式。

- `app/features/tasks/server/workspace-view.server.ts`
  - 当前状态：已聚合 `channelPresets` 摘要并在导航中把“预设”指向 `#presets`。
  - 本 story 要改：允许继续提供预设摘要，但导航/入口应指向正式预设路由，而不是仅靠 hash。
  - 必须保留：任务列表与 selectedTask 的现有装配逻辑。

- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
  - 当前状态：始终注入完整 `ChannelPresetWorkbench` 到 workspace shell。
  - 本 story 要改：如果继续显示预设区，应收缩为摘要预览与跳转入口，不要再把完整管理体验都压在首页。
  - 必须保留：当前 task panels、sync bridge 和 shell 组合方式。

- `app/features/presets/components/ChannelPresetWorkbench.tsx`
  - 当前状态：一个组件同时承载创建、列表和内联更新表单。
  - 本 story 要改：优先拆分为“列表/预览”和“最小创建”两个职责；避免再扩张 inline update。
  - 必须保留：现有成功/错误反馈文案基调、已验证的字段命名和 action contract。

- `app/features/presets/server/channel-presets.server.ts`
  - 当前状态：已有 `listChannelPresetsForUser`、`createChannelPreset`、`updateChannelPreset`、`findChannelPresetForSource` 等能力，字段校验已由 Zod 承担。
  - 本 story 要改：优先复用现有服务，必要时只补 route-oriented helper，不要重写核心契约。
  - 必须保留：owner 隔离、唯一约束冲突处理、request_id 错误返回结构。

- `database/schema/channel-presets.ts`
  - 当前状态：已有 `channel_presets` 表与 `uq_channel_presets_owner_source` 唯一约束。
  - 本 story 要改：通常无需再改 schema，除非最新 IA 明确需要最小范围内的附加展示字段。
  - 必须保留：当前 owner/source 唯一约束，避免影响 2.3 自动匹配稳定性。

- `tests/channel-presets.test.ts`
  - 当前状态：覆盖列表 summary、重复来源拒绝、字段校验、owner isolation、create/update action、source lookup。
  - 本 story 要改：补足新 route 的测试，但不要删除对现有基础能力的回归覆盖。
  - 必须保留：source lookup 测试，因为 `2.3` 会直接依赖。

### Recommended Implementation Sequence

1. 先确认现有 `channel_presets` schema 和 service 已满足最小创建真需求，避免无意义重构。
2. 增加 `presets` 路由族与页面壳子，把列表与最小创建迁出 workspace 的“唯一入口”角色。
3. 收缩 `workspace` 中的预设区为摘要预览和跳转入口，避免继续在首页堆叠管理表单。
4. 只在必要处拆分 `ChannelPresetWorkbench`，不要顺手实现完整详情页、完整编辑页或字幕样式预览。
5. 最后补齐 route 层测试和 workspace 回归。

### Implementation Guardrails

- 不要重建第二套 `channel_presets` schema 或平行 preset service。
- 不要把“有旧实现”误解成“当前 2.1 无事可做”；当前故事的工作重点是 IA 与路由归属收口。
- 不要把 `2.2` 的详情、编辑、只读预览和模拟播放器一并塞进本 story。
- 不要继续扩张 `/workspace` 成为完整预设后台；这是和当前架构决策直接冲突的最常见错误。
- 不要破坏 `findChannelPresetForSource` 或现有 create contract；`2.3` 会依赖这些能力做熟悉来源自动命中。
- 不要把错误反馈降级成 toast-only；字段级错误映射是后续复杂表单的基础。
- 不要为了“最小创建”而放宽 owner 访问控制或把预设资源做成匿名可访问。

### Testing Requirements

- 必须覆盖：
  - creator 访问 `/presets` 与 `/presets/new` 的成功路径
  - 非 creator 或越权访问被拒绝
  - 最小创建成功后列表可见
  - 字段级错误仍能通过 route action 返回并在 UI 呈现
  - workspace 仍显示预设入口/摘要，但不承担完整预设管理真入口
- 必须保留并继续通过：
  - `tests/channel-presets.test.ts`
  - `tests/workspace-view.test.ts`
  - 任何已依赖 workspace 壳子结构的测试
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`

### Latest Technical Information

- React Router 官方当前文档显示 `latest` 版本为 `7.17.0`，并继续强调 Framework Mode 下 `loader` 负责服务端数据加载、客户端导航会自动回调 server loader，且 `loader` 会从 client bundle 中移除。这进一步支持把预设列表/创建的数据访问放在 route loader/action 与 `.server` helper 中，而不是前端组件直连敏感服务逻辑。[Source: [React Router Data Loading](https://reactrouter.com/start/framework/data-loading)]
- 同一份官方文档也明确支持在需要时组合 `loader` 与 `clientLoader`，但本 story 的预设列表与最小创建并不需要额外引入 clientLoader；现有 route-driven 数据模式已经足够。[Source: [React Router Data Loading](https://reactrouter.com/start/framework/data-loading)]
- Zod 官方首页当前明确标注 “Zod 4 is stable”，并说明它是 TypeScript-first schema validation，适用于从简单字符串到复杂对象的校验；当前仓库已经锁定 `zod@^4.4.3`，因此继续复用现有 Zod 表单校验契约是与当前官方方向一致的。[Source: [Zod Intro](https://zod.dev/)]
- 当前仓库 `package.json` 依赖固定为 `react-router@7.14.0`、`react-hook-form@7.76.1`、`zod@^4.4.3`。据此推断，本 story 应遵循“在现有依赖版本上实现，不引入新表单框架”的策略；是否升级到 React Router `7.17.0` 不属于本 story 范围，应另开依赖升级工作项。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/package.json`]

### Project Context Reference

- workflow `persistent_facts` 指定的 `project-context.md` 在仓库中未找到匹配文件。
- 当前 story 依赖的有效上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-1-create-and-manage-channel-presets.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-7-completed-deliverables-and-secure-result-access.md`

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.1:-Preset-List-and-Minimal-Preset-Creation`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.2:-Preset-Detail,-Editing,-and-Subtitle-Preview`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Frontend-implication`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Component-and-Route-Architecture`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Workspace-Overview-页面`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-List-页面`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Detail-页面-/-可寻址弹窗`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Edit-页面-/-可寻址弹窗`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /Users/reuszeng/Code/Projects/Yakimoji/_bmad/scripts/resolve_customization.py --skill /Users/reuszeng/Code/Projects/Yakimoji/.agents/skills/bmad-create-story --key workflow`
- `git log --oneline -5`
- `git status --short`
- `pnpm typecheck`
- `pnpm test`

### Completion Notes List

- 2026-06-15: Created current-planning story artifact for `2-1-preset-list-and-minimal-preset-creation`.
- 2026-06-15: Reconciled current sprint story identity with historical `2-1-create-and-manage-channel-presets` implementation artifact.
- 2026-06-15: Set story status to `ready-for-dev` and prepared implementation guardrails to prevent scope bleed into Story 2.2.
- 2026-06-15: Added dedicated `/presets` and `/presets/new` routes, keeping loader/action ownership inside the presets route family.
- 2026-06-15: Reduced workspace preset area to summary plus entry links so `/workspace` no longer acts as the full preset management surface.
- 2026-06-15: Preserved existing preset schema/service contracts and added route-level regression coverage for preset list/create entry points.

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-1-preset-list-and-minimal-preset-creation.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/features/presets/components/ChannelPresetWorkbench.tsx`
- `app/features/presets/server/preset-routes.server.ts`
- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
- `app/features/tasks/server/workspace-view.server.ts`
- `app/routes.ts`
- `app/routes/presets.tsx`
- `app/routes/presets.new.tsx`
- `app/routes/workspace.tsx`
- `tests/api/tasks-query-routes.test.mjs`
- `tests/preset-routes.test.ts`
- `tests/workspace-view.test.ts`

### Change Log

- 2026-06-15: Added dedicated preset list/create routes, moved preset create handling out of `/workspace`, and narrowed workspace preset UI to summary + entry links.
