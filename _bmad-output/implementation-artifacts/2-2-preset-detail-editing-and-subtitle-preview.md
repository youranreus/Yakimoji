# Story 2.2: Preset Detail, Editing, and Subtitle Preview

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 通过独立的详情与编辑界面查看并调整频道预设,
so that 我能清楚维护长期资产，并在保存前预览字幕样式效果。

## Acceptance Criteria

1. **Given** 创作者打开某个已存在的频道预设  
   **When** 进入预设详情页或等价可寻址状态  
   **Then** 系统必须展示来源频道、默认翻译方向、默认字幕模板和默认输出偏好  
   **And** 这些字段必须以清晰、可读的方式展示，而不是只暴露底层技术值
2. **Given** 创作者需要修改已有频道预设  
   **When** 进入预设编辑流程  
   **Then** 预设编辑应拥有独立路由或可寻址状态  
   **And** 该流程必须承接预设基础信息与字幕样式配置，而不是继续挂在 workspace 内联区域中
3. **Given** 创作者在预设编辑页调整字体大小、字幕模板等允许范围内的样式配置  
   **When** 配置变化  
   **Then** 页面必须同步展示模拟播放器或等价预览区域  
   **And** 用户不需要离开编辑上下文即可观察效果
4. **Given** 创作者查看只读详情页  
   **When** 页面展示字幕样式效果  
   **Then** 预览必须明确区分只读详情模式和可编辑模式  
   **And** 详情页不能直接修改配置
5. **Given** 创作者修改并保存预设  
   **When** 系统保存成功  
   **Then** 系统必须更新该预设的已保存规则  
   **And** 更新后的内容应成为后续任务命中该预设时的默认值来源
6. **Given** 某个任务后续使用该预设并需要任务级字幕模板覆盖  
   **When** 创作者在任务创建流程中覆盖字幕模板  
   **Then** 系统必须能明确区分预设默认模板与任务级覆盖模板  
   **And** 不得把任务级覆盖隐式回写到频道预设本身
7. **Given** 创作者越权访问他人预设详情或编辑页  
   **When** 系统执行授权检查  
   **Then** 系统必须拒绝该访问  
   **And** 不得因详情页或编辑页拆分而放宽授权边界

## Tasks / Subtasks

- [x] 为预设详情与编辑建立独立可寻址路由 (AC: 1, 2, 4, 7)
  - [x] 在 `app/routes.ts` 注册预设详情与编辑入口，例如 `/presets/:presetId` 与 `/presets/:presetId/edit`
  - [x] 新增对应 route module，并将 loader/action 归属保持在 `presets` 路由族，禁止通过 `/workspace` 代理详情/编辑 mutation
  - [x] 详情页与编辑页都必须通过当前 creator session + owner 范围校验预设归属；越权访问返回一致的 403 语义和 `request_id`

- [x] 扩展预设服务层，支持按 ID 读取详情和正式编辑保存 (AC: 1, 5, 7)
  - [x] 复用 `getChannelPresetByIdForUser`、`updateChannelPreset` 与现有 Zod 校验，不重造平行 service
  - [x] 按详情/编辑页面需要补齐 view model，保留现有 `ChannelPresetView.defaults`、`summary`、`id` 等字段契约，避免破坏 `2.3` 命中和任务快照逻辑
  - [x] 若需要承载字体大小等少量样式配置，优先在现有 `metadata` 上建立受控、类型化的应用层映射；不要引入完整字幕编辑 DSL 或超范围样式系统

- [x] 落地只读详情页面，明确“查看”和“修改”分离 (AC: 1, 4, 7)
  - [x] 在 `app/features/presets/components/` 中拆分详情视图与编辑表单，不再让 `ChannelPresetWorkbench` 继续承载所有场景
  - [x] 详情页展示来源频道、默认翻译方向、默认字幕模板、默认输出偏好、备注，以及字幕样式只读预览摘要
  - [x] 详情页主操作是“编辑预设”，而不是内联修改；只读页不得直接提交更新

- [x] 落地正式编辑页与实时字幕样式预览 (AC: 2, 3, 5, 6)
  - [x] 编辑页使用 React Hook Form + Zod resolver 组织复杂表单，保持服务端 schema 为最终真源
  - [x] 表单至少覆盖当前已保存的基础字段，并在允许范围内支持少量字幕样式配置，例如字体大小或预览相关轻量样式参数
  - [x] 页面内提供模拟播放器或等价预览区；预览应随着表单变化同步刷新，但不得演变成复杂视频编辑器
  - [x] 保存成功后返回明确成功反馈，并让详情/列表重新加载最新摘要；失败时保留字段级错误映射与 `request_id`

- [x] 保护后续任务创建语义，避免预设编辑污染任务级覆盖边界 (AC: 5, 6)
  - [x] 保持 `findChannelPresetForSource`、任务 `presetSnapshot`、`processingBaselineSnapshot` 和任务级 `subtitleTemplateOverride` 语义不变
  - [x] 仅更新频道预设默认值与预设自身样式配置，不得回写任何历史任务记录
  - [x] 在详情/编辑 UI 文案中明确“预设默认模板”和“任务级覆盖模板”是两层概念，为后续 `2.5` 保留清晰边界

- [x] 补齐预设详情/编辑与回归测试 (AC: 1, 3, 4, 5, 6, 7)
  - [x] 新增 route/service 测试，覆盖 owner 可读、越权拒绝、详情只读、编辑保存成功、字段级错误与实时预览基础数据装配
  - [x] 保持 `tests/preset-routes.test.ts`、`tests/channel-presets.test.ts`、`tests/task-intake.test.ts`、`tests/workspace-view.test.ts` 继续通过
  - [x] 完成后运行 `pnpm typecheck` 与 `pnpm test`

## Dev Notes

### Story Intent

- 当前规划下的 `2.2` 是“正式资产维护页”故事，不是再给 `/workspace` 补一块更大的内联表单。
- `2.1` 已经把列表和最小创建从工作台剥离出来；`2.2` 要继续完成详情只读、独立编辑和字幕预览三件事。
- 这一步必须把“查看”和“修改”明确拆开，避免用户在只读确认态里误改配置，也避免 UI 语义继续混在一个 workbench 组件里。

### Epic and Cross-story Context

- Epic 2 的结构已经稳定为：`2.1` 建立独立列表与最小创建入口，`2.2` 负责详情/编辑/预览，`2.3` 负责熟悉来源自动命中，`2.4` 负责未命中时人工决策，`2.5` 负责任务级字幕模板覆盖。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.2:-Preset-Detail,-Editing,-and-Subtitle-Preview`]
- 目录中已有历史误命名产物 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-resolve-preset-match-for-familiar-sources.md`，其内容实际对应当前规划的 `2.3`。开发时必须以当前 `sprint-status.yaml` 和 `epics.md` 为准，不要把这份旧文档当作当前 `2.2` 实现目标。
- 当前真实前置故事应视为 `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-1-preset-list-and-minimal-preset-creation.md`，因为它已落地了独立 `/presets`、`/presets/new` 路由与 workspace 摘要收口。

### Previous Story Intelligence

- `2.1` 已完成并固定了几个关键边界：
  - `workspace` 只保留预设摘要和入口，不再作为完整预设管理真入口
  - `presets` 路由族已经存在，当前只有列表和创建页
  - `ChannelPresetWorkbench` 仍然是大一统组件，但已被限制为 `workspace`/`list`/`create` 三种模式
  - `preset-routes.server.ts` 当前只承载列表 loader 和创建 action，并显式阻断 `update_channel_preset` 从 `/presets/new` 泄漏进去
- 对 `2.2` 的直接启示：
  - 不要把更新动作重新塞回 `/presets/new` 或 `/workspace`
  - 不要继续膨胀 `ChannelPresetWorkbench` 成为“列表 + 创建 + 详情 + 编辑 + 预览”的超级组件
  - 预设领域已经有 owner-scoped list/create/update/get-by-id 能力，应优先围绕现有契约补 route/view model，而不是推倒重来

### Current Codebase State

- `app/routes.ts`
  - 当前已有 `/presets` 与 `/presets/new`
  - 缺口是详情/编辑路由缺失
  - 必须保留现有 route 命名风格和 React Router file-route 组织方式

- `app/routes/presets.tsx`
  - 当前状态：仅展示预设摘要列表
  - 本 story 要改：为列表项增加进入详情/编辑的明确入口，但不要把详情直接内联塞回列表页
  - 必须保留：creator-only access 和错误边界风格

- `app/routes/presets.new.tsx`
  - 当前状态：只允许 `create_channel_preset`
  - 本 story 要改：保持该入口只做最小创建，不要混入编辑逻辑
  - 必须保留：阻断 update intent 的行为

- `app/features/presets/components/ChannelPresetWorkbench.tsx`
  - 当前状态：承载 workspace 摘要、列表页和创建页
  - 本 story 要改：从中拆出更小的详情/编辑组件；如果继续复用局部列表或反馈组件可以，但不要让它继续吞掉全部页面职责
  - 必须保留：当前 list/create 的已验证 UX 和字段命名

- `app/features/presets/server/channel-presets.server.ts`
  - 当前状态：已有 `listChannelPresetsForUser`、`findChannelPresetForSource`、`getChannelPresetByIdForUser`、`createChannelPreset`、`updateChannelPreset`
  - 本 story 要改：为详情/编辑组织更合适的 view model，必要时扩展输入 schema 以支持少量样式配置
  - 必须保留：字段级错误、owner 隔离、`request_id`、`summary/defaults` 语义

- `app/features/presets/server/preset-routes.server.ts`
  - 当前状态：只有列表 loader 和创建 action
  - 本 story 要改：新增详情/编辑路由所需 loader/action helper，不要让 route 直接堆业务逻辑
  - 必须保留：统一鉴权和 creator resource authorization 调用模式

- `database/schema/channel-presets.ts`
  - 当前状态：显式字段只有 `sourceIdentifier`、`displayName`、`translationMode`、`subtitleTemplate`、`outputPackage`、`notes`，另有 `metadata jsonb`
  - 本 story 要改：若要保存“字体大小”等有限预览样式，优先考虑受控使用 `metadata` 而不是马上新增大量列
  - 必须保留：`uq_channel_presets_owner_source` 唯一约束和现有字段含义

- `app/features/tasks/server/task-intake.server.ts` 及相关测试
  - 当前状态：`2.3` 的历史实现已经让任务预览/创建依赖 `findChannelPresetForSource`、`presetSnapshot`、`subtitleTemplate`
  - 本 story 要改：编辑预设后允许未来任务命中更新后的默认值，但不能改写历史任务快照
  - 必须保留：任务级覆盖与预设默认值分层语义

### Architecture Compliance

- 预设相关 loader/action 必须归属 `presets` 路由族；`workspace` loader 只能加载总览摘要数据，不承担完整预设编辑模型或 mutation。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`]
- 预设编辑页和模拟播放器字幕预览被架构明确归为复杂交互型表单，应使用 React Hook Form 组织，配合 Zod 做前后端一致的 schema 对齐。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Form-and-Validation-Strategy`]
- 代码组织继续遵循 route layer + feature layer + shared layer；预设领域组件与 server helper 应留在 `features/presets/`，不要散落到 `shared/` 或 `workspace` 相关模块。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Component-and-Route-Architecture`]
- 重要失败态要用结构化页面反馈，不要只靠 toast；详情/编辑越权、保存失败都应延续现有 `request_id` 可见模式。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error-Handling-and-Observability-Hooks`]

### UX Guardrails

- UX 文档已经把 `Preset List`、`Preset Detail`、`Preset Edit` 定义成三个职责不同的页面：列表展示资产和入口；详情只读确认当前规则；编辑页承载基础信息、少量样式配置和实时预览。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-List-页面`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Detail-页面-/-可寻址弹窗`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Edit-页面-/-可寻址弹窗`]
- 编辑页允许的样式范围是“模板 + 少量样式配置”，例如字体大小；不允许扩展成复杂字幕编辑器、翻译风格后台或完整视频预览器。
- 详情页的预览必须明显只读，避免用户误以为在详情页看到的变化已保存。
- `Task Create` 页面约束已明确：任务创建流程不承载完整预设编辑，后续陌生频道最小预设流程也应只做最小创建，完整编辑应跳转预设编辑页。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Task-Create-页面-/-可寻址弹窗`]

### Data Model and Integration Guidance

- 当前 `channel_presets` 表没有单独的 `font_size`、`preview_style` 等列，但有 `metadata jsonb`。这意味着：
  - 若 `2.2` 仅需保存少量预览样式，优先在应用层定义一个非常小的 typed metadata shape，例如 `subtitleStylePreview.fontSize`、`subtitleStylePreview.theme`
  - 不要在本 story 中设计通用富样式 schema 或支持任意深度的字幕渲染配置
  - `ChannelPresetView` 可以新增 detail-only 字段，但现有 `defaults.translationMode` / `defaults.subtitleTemplate` / `defaults.outputPackage` 应保持稳定
- 任务匹配和快照相关能力已经在历史 `2.3` 实现中依赖 `subtitleTemplate` 等基础字段；`2.2` 修改预设后只影响未来任务，不影响已写入任务的 `presetSnapshot`

### Recommended Implementation Sequence

1. 先为详情和编辑确定路由结构，并决定使用详情页 + 编辑页两个文件路由，而不是在列表页里开不可寻址本地状态。
2. 基于 `getChannelPresetByIdForUser` 为详情页装配只读 view model，再为编辑页装配 form default values。
3. 若需要新增少量样式字段，先收敛数据模型边界，优先通过 `metadata` 做受控扩展。
4. 拆出详情组件、编辑表单组件、预览组件；避免继续扩大 `ChannelPresetWorkbench`。
5. 编辑保存成功后让详情/列表自然 revalidate，同时保留结构化错误反馈。
6. 最后补齐 route/service/task regression tests，确保 `2.3` 和未来 `2.5` 语义未被破坏。

### Implementation Guardrails

- 不要把详情或编辑重新挂回 `/workspace`。
- 不要把 `update_channel_preset` 悄悄放进 `/presets/new`。
- 不要创建第二套 preset service、第二套 owner 校验或第二套字段错误格式。
- 不要为了做预览而发明复杂字幕样式 DSL；本 story 只允许少量、可控、可预览的样式参数。
- 不要让详情页直接可编辑，避免只读与编辑状态混淆。
- 不要破坏 `findChannelPresetForSource`、`presetSnapshot`、任务级 `subtitleTemplateOverride` 的既有语义。
- 不要改写历史任务记录来“同步”预设修改结果。

### Testing Requirements

- 必须新增或补齐：
  - 预设详情 loader 测试
  - 预设编辑 loader/action 测试
  - owner 越权访问 403 测试
  - 编辑保存成功后返回 updated 结果与字段错误映射测试
  - 预览 view model 基础装配测试
- 必须继续通过：
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/preset-routes.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/channel-presets.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
  - `/Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-view.test.ts`
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`

### Git Intelligence Summary

- 最近与 Epic 2 直接相关的提交是 `feat: add dedicated preset routes`，它已经把 `/presets` 和 `/presets/new` 建起来，并明确把 workspace 收缩为摘要入口。
- 在它之前连续多次 `docs:` 提交都在修正 planning artifacts 和 story identity，说明这个区域近期最容易出错的点不是“写不出表单”，而是“拿错 story 边界”。
- 直接结论：`2.2` 必须严格沿当前 IA 往下推进，不能再沿旧版 `2-2-resolve-preset-match...` 命名历史走偏。

### Latest Technical Information

- React Router 官方 `Data Loading` 文档当前显示 `latest` 版本为 `7.17.0`，并继续强调 Framework Mode 下 `loader` 用于初始加载和客户端导航，且 `loader` 会从 client bundle 中移除。这支持本 story 继续把预设详情/编辑的数据读取和提交放在 route `loader` / `action` 与 `.server` helper 中，而不是让客户端组件直连服务逻辑。[Source: https://reactrouter.com/start/framework/data-loading]
- Zod 官方当前首页明确写明 “Zod 4 is stable”，并强调它是 TypeScript-first schema validation with static type inference。仓库当前已依赖 `zod@^4.4.3`，因此应继续在预设编辑表单中复用 Zod v4，而不是引入另一套校验方案。[Source: https://zod.dev/]
- React Hook Form 官方 README 当前将其定位为 “Built with performance, UX and DX in mind”，并明确支持 Zod 等 resolver。结合现有依赖 `react-hook-form@7.76.1` 与 `@hookform/resolvers`，`2.2` 的复杂编辑表单应优先使用 RHF + Zod resolver，而不是退回手写受控表单状态。[Source: https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/README.md]
- 当前仓库 `package.json` 固定使用 `react-router@7.14.0`、`@react-router/dev@7.14.0`、`react-hook-form@7.76.1`、`zod@^4.4.3`。据此推断，本 story 的实现目标是在现有依赖版本上完成详情/编辑/预览，不把框架升级混入本 story。

### Project Context Reference

- workflow `persistent_facts` 要求的 `project-context.md` 在当前仓库中未找到匹配文件。
- 本 story 实际依赖的项目事实来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-1-preset-list-and-minimal-preset-creation.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-resolve-preset-match-for-familiar-sources.md`（仅作历史情报，不作当前 story 范围依据）

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-2.2:-Preset-Detail,-Editing,-and-Subtitle-Preview`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Fetching-and-Cache-Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Form-and-Validation-Strategy`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Component-and-Route-Architecture`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error-Handling-and-Observability-Hooks`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Detail-页面-/-可寻址弹窗`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Preset-Edit-页面-/-可寻址弹窗`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Task-Create-页面-/-可寻址弹窗`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /Users/reuszeng/Code/Projects/Yakimoji/_bmad/scripts/resolve_customization.py --skill /Users/reuszeng/Code/Projects/Yakimoji/.agents/skills/bmad-create-story --key workflow`
- `git log --oneline -5`
- `sed -n '514,760p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
- `sed -n '989,1169p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
- `sed -n '542,571p' /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
- `sed -n '1,320p' /Users/reuszeng/Code/Projects/Yakimoji/app/features/presets/server/channel-presets.server.ts`
- `sed -n '1,240p' /Users/reuszeng/Code/Projects/Yakimoji/app/routes/presets.tsx`
- `sed -n '1,240p' /Users/reuszeng/Code/Projects/Yakimoji/app/routes/presets.new.tsx`
- `sed -n '1,240p' /Users/reuszeng/Code/Projects/Yakimoji/database/schema/channel-presets.ts`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/app/routes.ts`
- `sed -n '1,360p' /Users/reuszeng/Code/Projects/Yakimoji/app/features/presets/server/preset-routes.server.ts`
- `sed -n '1,360p' /Users/reuszeng/Code/Projects/Yakimoji/app/features/presets/components/ChannelPresetWorkbench.tsx`
- `sed -n '1,320p' /Users/reuszeng/Code/Projects/Yakimoji/tests/preset-routes.test.ts`
- `sed -n '1,360p' /Users/reuszeng/Code/Projects/Yakimoji/tests/channel-presets.test.ts`
- `sed -n '1,320p' /Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
- `sed -n '1,260p' /Users/reuszeng/Code/Projects/Yakimoji/tests/workspace-view.test.ts`
- `rg -n "react-hook-form|useForm|zodResolver" /Users/reuszeng/Code/Projects/Yakimoji/app /Users/reuszeng/Code/Projects/Yakimoji/tests`
- `rg -n "presetSnapshot|subtitleTemplateOverride|processingBaselineSnapshot|findChannelPresetForSource" /Users/reuszeng/Code/Projects/Yakimoji/app /Users/reuszeng/Code/Projects/Yakimoji/tests`

### Completion Notes List

- 2026-06-15: Created current-planning story artifact for `2-2-preset-detail-editing-and-subtitle-preview`.
- 2026-06-15: Reconciled current `2-2` scope with the historical misnamed `2-2-resolve-preset-match-for-familiar-sources` artifact.
- 2026-06-15: Captured explicit guardrails to prevent implementation from leaking back into `/workspace` or forward into `2.3`/`2.5`.
- 2026-06-15: Set story status to `ready-for-dev` and updated sprint tracking accordingly.
- 2026-06-15: Began implementation by loading sprint status, story context, preset routes/services, and regression-test dependencies; moved story to `in-progress`.
- 2026-06-15: Added dedicated `/presets/:presetId` and `/presets/:presetId/edit` routes with creator-scoped loaders/actions and consistent `403 + request_id` handling.
- 2026-06-15: Extended preset service/view models with typed `metadata.subtitleStylePreview` mapping so detail/edit pages can persist limited preview style settings without changing task snapshot semantics.
- 2026-06-15: Implemented separate preset detail/edit screens, a read-only/live subtitle preview surface, and RHF + Zod powered edit validation with inline field errors.
- 2026-06-15: Preserved task-level override boundaries by keeping future-task baseline usage tied to `defaults` only and by supplying default preview metadata when task flow creates a minimal preset.
- 2026-06-15: Verified the story with `pnpm typecheck` and full `pnpm test`.

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/2-2-preset-detail-editing-and-subtitle-preview.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/app.css`
- `app/features/presets/components/ChannelPresetWorkbench.tsx`
- `app/features/presets/components/ChannelPresetDetailScreens.tsx`
- `app/features/presets/preset-form.shared.ts`
- `app/features/presets/server/channel-presets.server.ts`
- `app/features/presets/server/preset-routes.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/routes.ts`
- `app/routes/presets.new.tsx`
- `app/routes/presets.$presetId.tsx`
- `app/routes/presets.$presetId.edit.tsx`
- `tests/channel-presets.test.ts`
- `tests/preset-routes.test.ts`
- `tests/task-intake.test.ts`

### Change Log

- 2026-06-15: Added dedicated preset detail/edit routes, typed preview-style metadata support, separate detail/edit UI with live preview, and regression coverage for owner access, inline validation, and task override boundary preservation.
