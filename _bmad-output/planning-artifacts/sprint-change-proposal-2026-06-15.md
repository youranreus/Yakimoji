# Sprint Change Proposal - 产品信息架构与预设编辑纠偏

日期：2026-06-15  
项目：Yakimoji  
提出人：Codex / bmad-correct-course  
沟通语言：中文  
建议范围级别：Moderate

## 1. Issue Summary

Yakimoji 已完整实现 Epic 1 到 Epic 6 的主要能力闭环，但当前前端产品实现把过多功能集中在 `workspace` 页面：任务导入、任务列表、任务详情、预设列表、预设创建 / 编辑 action 与局部详情面板被混合承载，导致登录后产品的信息架构不清晰。

本次纠偏的触发问题是：`workspace` 不应继续作为所有任务链路和预设链路的承载页。它应回归“工作入口与总览”职责，而任务、预设、详情、创建、编辑等核心对象应拥有清晰路由或等价可寻址 UI 状态边界。

用户期望的目标结构为：

- `workspace` 工作台页面：整体入口，展示基础信息、任务列表预览与入口、任务创建入口、预设列表预览与入口；存在运行中任务时，banner 优先展示。
- 任务列表页：展示任务列表。
- 任务详情页 / 弹窗：展示任务详情。
- 预设列表页：展示当前已配置预设。
- 预设详情 / 编辑页 / 弹窗：展示预设配置。编辑是核心体验，需要支持基础信息配置、字幕样式预览、模拟播放器和字体大小等样式调整。详情页为只读预览。
- 任务创建页 / 弹窗：承接任务创建链路。

## 2. Impact Analysis

### Epic Impact

Epic 1 到 Epic 6 不应被改写为“从一开始就正确规划了当前 IA”。它们已经形成真实交付历史，应保留其完成语义。

本次变更建议新增一个纠偏型 Epic：

`Epic 7: Product Information Architecture and Preset Editing Refactor`

该 Epic 作为交付后的结构性重构，不推翻既有业务能力，而是在现有能力基础上重构产品承载方式。

### Story Impact

建议新增以下 follow-up stories：

- `Story 7.1: Workspace Overview and Object Route Boundary Refactor`
- `Story 7.2: Task List, Task Detail, and Task Creation Route Split`
- `Story 7.3: Preset List, Preset Detail, and Preset Edit Route Split`
- `Story 7.4: Subtitle Style Preview with Simulated Player`

旧 story 保留历史，不建议直接回写为新目标形态。

### Artifact Conflicts

PRD 当前存在“SPA 连续体验”可能被误读为“单页堆叠”的表述，需要补充说明：SPA 体验不等于所有功能塞进 `workspace`。

Architecture 已提出任务、预设、人工介入、结果下载等对象，但缺少硬性路由清单、loader/action ownership 规则，以及禁止 `workspace` 代理所有 mutation 的约束。

UX 已定义导航围绕核心对象，也包含字幕样式配置模块，但没有把 `workspace overview`、任务页、预设页、预设编辑页和模拟播放器预览明确成页面级规格。

### Technical Impact

后续实现会影响：

- `workspace` loader/action 拆分
- `tasks` 路由族建立或重构
- `presets` 路由族建立或重构
- 任务和预设 view model 分离
- 全局导航改为对象级导航
- 预设编辑中的模拟播放器预览组件
- 现有 workspace 集成测试与路由测试

## 3. Recommended Approach

推荐路径：Direct Adjustment with Dedicated Refactor Epic

不建议回滚 Epic 1 到 Epic 6，也不建议把旧 story 全部改写成现在的新目标。更稳妥的方式是：

1. 保留已交付历史。
2. 更新 PRD / Architecture / UX 的当前目标真相。
3. 在 Epics 中新增 Epic 7 作为结构纠偏。
4. 通过 Epic 7 的 stories 执行路由拆分、页面职责拆分和预设编辑体验升级。

Effort estimate：Medium  
Risk level：Medium  
Timeline impact：需要插入一轮前端信息架构重构，可能延后 review / ops / mobile 的细节打磨，但会显著降低后续功能继续堆叠在 workspace 的风险。

## 4. Detailed Change Proposals

### PRD 修改提案

Section: Web 应用特定要求 / 项目类型概述

OLD:

```md
Yakimoji 第一阶段应被实现为一个以登录后工作台为核心的单页 Web 应用（SPA）。产品的主要使用场景是高频任务处理、频道预设复用、任务状态跟踪与异常确认，因此核心体验应围绕持续操作效率而非页面跳转式浏览展开。
```

NEW:

```md
Yakimoji 第一阶段应被实现为一个以登录后工作台为核心、但按核心对象清晰分路由组织的 Web 应用。SPA 体验的目标是保证登录后操作连续、状态同步顺滑，而不是把任务、预设、详情、创建与异常处理全部压入同一个页面。

`workspace` 应承担总览与入口职责：展示当前账号的基础工作状态、运行中任务 banner、任务列表预览与入口、任务创建入口、预设列表预览与入口。任务列表、任务详情、任务创建、预设列表、预设详情与预设编辑应拥有独立路由或等价的可寻址 UI 状态边界，以保证产品信息架构与后续实现边界清晰。
```

Rationale:

修正“SPA 被误解为单页堆叠”的根因，同时保留工作台作为登录后入口的产品定位。

### Epics 修改提案

Section: Epic List

新增：

```md
### Epic 7: Product Information Architecture and Preset Editing Refactor
在保留 Epic 1-6 已交付能力闭环的前提下，重构登录后产品的信息架构与路由边界，使 workspace 回归总览入口，并将任务、预设、详情、创建与编辑流程拆分为清晰、可寻址、可维护的页面或等价 UI 状态边界。
**FRs covered:** FR8, FR9, FR13, FR14, FR17, FR20, FR22, FR37
```

新增 Epic 7 详细内容：

```md
## Epic 7: Product Information Architecture and Preset Editing Refactor

Epic 1-6 已实现 Yakimoji 的主要能力闭环，但当前前端实现把任务入口、任务列表、任务详情、预设列表、预设编辑和创建动作集中在 workspace 页面，导致产品信息架构不清、路由职责不稳定，并削弱了频道预设作为核心资产的编辑与预览体验。

本 Epic 不推翻既有业务能力，也不重写已完成 story 的历史语义。它作为交付后的纠偏 Epic，目标是在现有能力基础上重构产品承载方式：workspace 只承担工作入口和总览职责，任务与预设进入独立路由体系，预设编辑页提供模拟播放器和字幕样式预览，使后续维护、移动端适配和功能扩展建立在清晰边界上。
```

新增 stories：

```md
### Story 7.1: Workspace Overview and Object Route Boundary Refactor

As a 创作者,
I want workspace 只作为工作入口展示关键概览与入口,
So that 我不会在一个页面里被任务、预设、详情和创建流程混在一起干扰。

Acceptance Criteria:
- Given 创作者进入 workspace, When 页面加载, Then 页面应展示基础工作状态、运行中任务 banner、任务列表预览与入口、任务创建入口、预设列表预览与入口。
- Given 创作者需要查看完整任务列表, When 触发任务入口, Then 系统应导航到独立任务列表路由，而不是在 workspace 内展开完整任务管理。
- Given 创作者需要查看或管理预设, When 触发预设入口, Then 系统应导航到独立预设列表路由，而不是依赖 workspace 锚点或内嵌面板。
- Given workspace 加载数据, When loader 执行, Then 它只应加载总览所需摘要数据，不应同时承担任务详情和完整预设编辑数据。

### Story 7.2: Task List, Task Detail, and Task Creation Route Split

As a 创作者,
I want 任务列表、任务详情和任务创建有清晰入口,
So that 我可以按任务链路连续操作，而不是在 workspace 中寻找隐藏面板。

Acceptance Criteria:
- 任务列表应拥有独立路由，支持分页、状态摘要和进入详情。
- 任务详情应拥有独立路由或可寻址弹窗状态，展示状态、来源、时间线、交付物和异常信息。
- 任务创建应拥有独立路由或可寻址弹窗状态，承接 YouTube 链接、上传、来源识别和预设命中确认。
- 任务创建和任务详情 action 不应继续挂在 workspace action 中。

### Story 7.3: Preset List, Preset Detail, and Preset Edit Route Split

As a 创作者,
I want 预设列表、预设详情和预设编辑有独立承载界面,
So that 频道预设能作为长期资产被清楚查看、维护和复用。

Acceptance Criteria:
- 预设列表应拥有独立路由，展示已配置预设摘要和创建入口。
- 预设详情应支持只读预览，展示来源频道、默认翻译方向、字幕模板、输出偏好和样式效果摘要。
- 预设编辑应拥有独立路由或可寻址弹窗状态，承接预设基础信息和字幕样式配置。
- 预设创建、更新 action 不应继续挂在 workspace action 中。
- 越权访问他人预设时必须返回 403 或 404。

### Story 7.4: Subtitle Style Preview with Simulated Player

As a 创作者,
I want 在预设编辑中通过模拟播放器预览字幕样式,
So that 我能在保存前直观看到当前预设实际会产生的字幕效果。

Acceptance Criteria:
- 预设编辑页必须包含模拟播放器区域，用于展示当前字幕样式在视频画面中的实际效果。
- 用户调整字体大小、字幕模板等允许范围内的样式配置时，预览应同步反映变化。
- 预览必须明确区分只读详情模式和可编辑模式。
- 预览能力应保持在第一阶段边界内，不扩展成逐句字幕编辑器或复杂视频编辑器。
- 字幕预览差异必须提供文本辅助说明，不能只依赖视觉差异表达。
```

Rationale:

新增纠偏型 Epic，避免篡改已完成 Epic 1-6 的历史，同时给后续开发提供清晰、可执行的重构范围。

### Architecture 修改提案

Section: Frontend implication

OLD:

```md
**Frontend implication:**
- 公开内容页不是当前前端架构中心
- 工作台路由优先围绕任务、预设、人工介入、结果下载构建
- 前端渲染策略服务于身份与工作流，而不是服务于 SEO
```

NEW:

```md
**Frontend implication:**
- 公开内容页不是当前前端架构中心
- 登录后应用必须围绕核心对象建立清晰路由边界：workspace、tasks、presets、review、deliverables / results
- `workspace` 只负责总览与入口，不承载完整任务管理、任务详情、预设编辑或预设更新 action
- 前端渲染策略服务于身份与工作流，而不是服务于 SEO

**Core route ownership:**
- `/workspace`：工作入口与总览，展示基础状态、运行中任务 banner、任务预览、任务创建入口、预设预览、预设入口
- `/tasks`：任务列表，负责分页、筛选、状态摘要和进入详情
- `/tasks/new`：任务创建，负责链接导入、上传、来源识别、预设命中确认和任务级轻量覆盖
- `/tasks/:taskId`：任务详情，负责状态、来源、时间线、交付物、失败解释和恢复入口
- `/presets`：预设列表，负责展示已配置预设摘要和创建入口
- `/presets/new`：预设创建，负责最小预设创建和基础配置
- `/presets/:presetId`：预设详情，只读展示预设配置与字幕样式效果摘要
- `/presets/:presetId/edit`：预设编辑，负责基础信息、字幕样式配置、模拟播放器预览和保存
- `/review` 或 `/tasks/:taskId/review`：低置信度片段处理入口，具体形态可按任务上下文决定
- `/deliverables` 或 `/tasks/:taskId/result`：结果与交付物入口，具体形态可优先嵌入任务详情
```

Section: Data Fetching and Cache Model

新增：

```md
**Route data ownership constraints:**
- `workspace` loader 只能加载总览摘要数据，不应加载完整任务详情、完整预设编辑模型或承担创建/更新 action
- 任务相关 loader/action 必须归属 `tasks` 路由族
- 预设相关 loader/action 必须归属 `presets` 路由族
- review 与 deliverables 可以嵌入任务详情展示，但其 mutation/action 不应通过 workspace 代理
- 若使用弹窗或抽屉承载详情/创建流程，也必须保留可寻址 URL 或等价路由状态，避免重要流程只存在组件本地状态中
```

Rationale:

把“不再堆 workspace”变成架构约束，而不是停留在 UX 偏好。

### UX 修改提案

Section: 字幕样式配置模块

OLD:

```md
### 字幕样式配置模块

**Purpose:** 承接第一阶段允许存在的有限任务级覆盖，尤其是字幕模板与样式选择。  
**Usage:** 预设创建、预设编辑、任务级轻量覆盖场景。  
**Anatomy:** 模板选择、样式预览、少量关键配置项、当前应用结果摘要。  
**States:** 默认继承预设、任务级覆盖、预览中、应用成功。  
**Variants:** 预设编辑版、任务级紧凑版。  
**Accessibility:** 模板选项和预览差异需有文本辅助说明。  
**Content Guidelines:** 保持轻量，不扩展成复杂字幕编辑器。  
**Interaction Behavior:** 允许用户快速切换模板和少量样式设置，但始终限制在第一阶段边界内。
```

NEW:

```md
### 字幕样式配置模块

**Purpose:** 承接频道预设中的字幕模板与少量样式配置，让用户在保存预设前直观看到字幕实际效果。  
**Usage:** 预设创建、预设编辑、预设详情只读预览、任务级轻量覆盖场景。  
**Anatomy:** 模板选择、字体大小等少量关键样式配置、模拟播放器预览、当前应用结果摘要、文本化差异说明。  
**States:** 只读预览、编辑中、预览中、保存成功、保存失败。  
**Variants:** 预设详情只读版、预设编辑完整版、任务级紧凑版。  
**Accessibility:** 模板选项、字号变化和预览差异必须有文本辅助说明，不能只依赖画面视觉差异。  
**Content Guidelines:** 保持轻量，聚焦“预设保存后会如何影响字幕呈现”，不扩展成逐句字幕编辑器、时间轴编辑器或复杂视频编辑器。  
**Interaction Behavior:** 用户调整字体大小、字幕模板等允许范围内的配置时，模拟播放器应同步展示效果；只读详情模式只能查看效果，不能直接修改配置。
```

新增页面定义：

```md
### Workspace Overview 页面

**Purpose:** 作为登录后的工作入口和总览，不承载完整任务管理或预设编辑。  
**Content:** 基础工作状态、运行中任务 banner、任务列表预览、任务创建入口、预设列表预览、预设管理入口。  
**Primary Action:** 创建任务。  
**Secondary Actions:** 查看全部任务、查看全部预设、进入运行中任务详情。  
**Constraint:** 不在此页面展开完整任务详情、完整预设编辑表单或复杂异常处理流程。

### Task List 页面

**Purpose:** 展示任务列表、分页、状态摘要和进入详情入口。  
**Content:** 任务状态、来源摘要、预设命中信息、最近进展、分页控件。  
**Primary Action:** 创建任务或进入高优先级任务详情。  
**Constraint:** 列表页不预取完整事件历史。

### Task Detail 页面 / 可寻址弹窗

**Purpose:** 展示单个任务的完整状态上下文。  
**Content:** 当前状态、来源信息、预设应用信息、阶段时间线、交付物、失败解释、恢复入口。  
**Constraint:** 如果采用弹窗或抽屉，也必须保留可寻址状态，支持刷新和分享同一任务上下文。

### Preset List 页面

**Purpose:** 展示当前已配置的频道预设资产。  
**Content:** 预设名称、来源频道、默认翻译方向、字幕模板摘要、最近使用或复用信息。  
**Primary Action:** 创建预设。  
**Secondary Actions:** 查看详情、编辑预设。

### Preset Detail 页面 / 可寻址弹窗

**Purpose:** 只读展示预设配置和字幕样式效果，让用户确认这个预设当前会如何影响任务。  
**Content:** 来源频道、默认翻译方向、字幕模板、输出偏好、模拟播放器只读预览、应用结果摘要。  
**Primary Action:** 编辑预设。  
**Constraint:** 详情页不直接修改配置，避免只读确认与编辑状态混在一起。

### Preset Edit 页面 / 可寻址弹窗

**Purpose:** 编辑预设基础信息和字幕样式配置，是频道预设资产维护的核心页面。  
**Content:** 来源频道标识、默认翻译方向、默认字幕模板、默认输出偏好、字体大小等少量样式配置、模拟播放器实时预览。  
**Primary Action:** 保存预设。  
**Secondary Actions:** 取消、返回详情。  
**Constraint:** 编辑页不扩展为复杂字幕编辑器，只允许第一阶段定义的模板与少量样式配置。

### Task Create 页面 / 可寻址弹窗

**Purpose:** 承接任务创建入口，让用户通过链接或上传快速启动任务。  
**Content:** YouTube 链接输入、上传入口、来源识别反馈、预设命中确认、未命中决策、任务级字幕模板覆盖。  
**Primary Action:** 开始处理。  
**Constraint:** 不承载预设完整编辑；陌生频道创建预设只能走最小预设流程，完整编辑应跳转到预设编辑页。
```

Rationale:

把页面职责从原则提升到可执行 UX 规格，并明确预设详情只读、预设编辑可改、模拟播放器是核心组件但不是复杂编辑器。

## 5. Implementation Handoff

Change scope classification：Moderate

原因：

- 不需要推翻 Epic 1-6 或重做业务闭环。
- 需要重构前端路由、loader/action ownership 和页面职责。
- 需要新增预设编辑核心体验：模拟播放器字幕预览。
- 需要更新 PRD / Epics / Architecture / UX，再交给 Developer agent 分 story 实施。

Recommended handoff：

- Product / PO：批准本提案，并将 Epic 7 写入 epics 文档。
- Architect：更新 Architecture 中的路由 ownership 和数据边界约束。
- UX：更新页面定义、导航模式和字幕样式配置模块。
- Developer：按 Epic 7 拆分实现，不再向 `workspace` 累积任务与预设 mutation。

Success criteria：

- `workspace` 只加载和展示总览摘要。
- 任务列表、任务创建、任务详情拥有独立路由或可寻址 UI 状态。
- 预设列表、预设详情、预设编辑拥有独立路由或可寻址 UI 状态。
- 预设创建 / 更新 action 不再挂在 `workspace`。
- 任务创建 / 详情相关 action 不再挂在 `workspace`。
- 预设编辑支持模拟播放器和字幕样式实时预览。
- 详情页保持只读预览，不与编辑状态混用。

## 6. Checklist Status

- [x] 1.1 Identify triggering story / area
- [x] 1.2 Define core problem
- [x] 1.3 Gather evidence
- [x] 2.1 Evaluate current epic impact
- [x] 2.2 Determine epic-level changes
- [x] 2.3 Review remaining epics
- [x] 2.4 Check if new epic is needed
- [x] 2.5 Consider priority changes
- [x] 3.1 PRD conflict analysis
- [x] 3.2 Architecture conflict analysis
- [x] 3.3 UX conflict analysis
- [x] 3.4 Secondary artifact impact
- [x] 4.1 Direct Adjustment evaluation
- [N/A] 4.2 Potential Rollback evaluation
- [x] 4.3 PRD MVP Review evaluation
- [x] 4.4 Recommended path selection
- [x] 5.1 Issue summary
- [x] 5.2 Epic impact and artifact adjustment needs
- [x] 5.3 Recommended path
- [x] 5.4 PRD MVP impact and action plan
- [x] 5.5 Handoff plan

## 7. Approval

Status：Approved

User decision：yes

Approval note：

- 用户确认采用“保留 Epic 1-6 交付历史 + 新增 Epic 7 承载产品信息架构与预设编辑纠偏”的方案。
- 本提案获批后，后续文档更新与实现工作应以 Epic 7 为主线推进，而不是重写已完成 story 的历史语义。

## 8. Handoff Record

Scope classification：Moderate

Routed to：

- Product / PO：将 Epic 7 和 Story 7.1 - 7.4 纳入后续计划
- Architect：更新 PRD / Architecture 中的路由边界和 loader/action ownership 约束
- UX：更新 workspace、tasks、presets 相关页面定义及字幕模拟播放器规范
- Developer：按 Epic 7 实施路由拆分、workspace 收敛和预设编辑体验升级

Next steps：

1. 更新 `prd.md`、`epics.md`、`architecture.md`、`ux-design-specification.md`
2. 将 Epic 7 拆分为可执行开发任务
3. 实施路由重构与预设编辑模拟播放器
4. 补充对应测试与回归验证

Approval question resolved.
