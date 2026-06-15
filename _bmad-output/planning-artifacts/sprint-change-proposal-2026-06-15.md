# Sprint Change Proposal - Epics Readiness Correction

日期：2026-06-15  
项目：Yakimoji  
提出人：Codex / bmad-correct-course  
沟通语言：中文  
建议范围级别：Moderate  
模式：Incremental
审批状态：Approved
审批时间：2026-06-15

## 1. Issue Summary

本次变更由 implementation readiness 评估直接触发，而不是由新的业务需求、市场变化或运行中代码缺陷触发。问题集中出现在 `epics.md` 的最后一公里可执行性上：需求方向本身基本稳定，但 stories 还没有达到可以安全进入实现的就绪状态。

本次确认的触发问题共有 3 个：

1. `Epic 7` 存在同 epic 前向依赖，尤其是 `Story 7.1` 的验收依赖 `Story 7.2 / 7.3` 先建立独立路由。
2. `epics.md` 缺少 story 级 requirement traceability，目前只有 epic 级 `FRs covered`，没有每个 story 对 `FR / NFR / AR / UX-DR` 的显式映射。
3. 多项 `Additional Requirements` 与 `UX Design Requirements` 只停留在 requirements inventory，缺少明确 story owner，尤其是 `AR16`、`UX-DR3`、`UX-DR4`、`UX-DR5`、`UX-DR6`。

证据基础：

- [implementation-readiness-report-2026-06-15.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-15.md)
- [epics.md](/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md)

这些问题的共同性质不是“做错了产品”，而是“分解出来的实施单位还不够稳定”。

## 2. Impact Analysis

### Epic Impact

- 直接受影响的 epic：`Epic 7: Product Information Architecture and Preset Editing Refactor`
- 间接受影响的 epic：
  - `Epic 1`：需要承接工程质量基线与部分 app shell / navigation 相关约束
  - `Epic 5`：需要承接移动端 breakpoint 与 accessibility 基线
  - `Epic 7`：需要承接 route boundary、workspace 收敛、预设编辑预览、部分 design foundation 落点

结论：

- `Epic 1-6` 不需要推翻或重写用户价值目标
- `Epic 7` 不能按现状原样执行，必须调整 story sequencing 与边界
- 不建议新增新的补丁 epic；更合理的做法是在现有 epic 内修正 story 结构与 ownership

### Story Impact

当前需要修改的关键 stories：

- `Story 7.1`
  - 从“路由跳转已存在”的验收，收紧为“workspace 已收敛为总览摘要边界”
- 全部 stories
  - 增加 `Implements:` 与 `Supports:` requirement traceability 头部
- `Story 1.1`
  - 补充 `AR16` ownership
- `Story 5.1 / 5.2`
  - 补充 `UX-DR2 / UX-DR3 / UX-DR18` ownership 与最小可验证约束
- `Story 7.3 / 7.4`
  - 补充 `UX-DR14`、`UX-DR4 / 5 / 6 / 18` ownership

### Artifact Conflicts

#### PRD

- 不存在核心产品目标冲突
- MVP 无需缩减
- 如需补强，可在后续小修订中补一句：非功能和 UX 约束必须进入 story 层而非只停留在 inventory

#### Architecture

- 架构方向正确，无需推翻
- 但当前 architecture 中已定义的 route ownership、loader/action ownership、SSE/polling fallback、review resource 等约束，需要被 stories 显式承接

#### UX

- UX 方向正确，无核心冲突
- 但多个 UX-DR 未进入 story ownership，导致实现计划无法证明这些设计约束会被谁落实

### Technical Impact

这次变更主要影响 planning artifacts，不要求立即改代码，但会影响后续 implementation orchestration：

- `epics.md` 必须更新
- 后续 sprint planning 需要读取更新后的 stories
- 后续 story validation / dev story / code review 将依赖新的 traceability 结构
- CI/CD、OpenAPI contract validation、responsive / accessibility 验证责任需要明确归属

## 3. Recommended Approach

推荐路径：**Direct Adjustment**

不建议：

- 回滚既有 epic 结构
- 新增一个只负责补 requirement ownership 的技术 epic
- 缩减 PRD MVP 范围

推荐原因：

1. 问题根源位于 `epics.md` 的结构与可执行性，而不是 PRD / Architecture / UX 的方向错误。
2. 通过直接修订 stories，可以最小代价修复 sequencing、traceability 和 ownership 缺口。
3. 这条路径不会破坏已经形成的正确 solutioning 资产，也不会造成额外的产品方向噪音。

评估：

- Effort estimate：Medium
- Risk level：Low-Medium
- Timeline impact：需要一次 planning artifact 修订和后续重新验证，但远低于重做 solutioning 的成本

## 4. Detailed Change Proposals

### 4.1 Story Proposal - Eliminate Epic 7 Forward Dependency

Story: `Epic 7 / Story 7.1`  
Section: Story title + Acceptance Criteria

OLD:

```md
### Story 7.1: Workspace Overview and Object Route Boundary Refactor

As a 创作者,
I want workspace 只作为工作入口展示关键概览与入口,
So that 我不会在一个页面里被任务、预设、详情和创建流程混在一起干扰。

**Acceptance Criteria:**

**Given** 创作者进入 workspace
**When** 页面加载
**Then** 页面应展示基础工作状态、运行中任务 banner、任务列表预览与入口、任务创建入口、预设列表预览与入口
**And** 不应在此页面展开完整任务详情、完整预设编辑表单或复杂异常处理流程

**Given** 创作者需要查看完整任务列表
**When** 触发任务入口
**Then** 系统应导航到独立任务列表路由
**And** 不应在 workspace 内展开完整任务管理

**Given** 创作者需要查看或管理预设
**When** 触发预设入口
**Then** 系统应导航到独立预设列表路由
**And** 不应依赖 workspace 锚点或内嵌面板作为唯一正式入口

**Given** workspace 加载数据
**When** loader 执行
**Then** 它只应加载总览所需摘要数据
**And** 不应同时承担任务详情和完整预设编辑数据
```

NEW:

```md
### Story 7.1: Workspace Overview Summary Boundary Refactor

As a 创作者,
I want workspace 只作为工作入口展示关键概览与摘要信息,
So that 我不会在一个页面里被任务、预设、详情和创建流程混在一起干扰。

**Acceptance Criteria:**

**Given** 创作者进入 workspace
**When** 页面加载
**Then** 页面应展示基础工作状态、运行中任务 banner、任务列表预览、任务创建入口、预设列表预览与预设入口占位
**And** 不应在此页面展开完整任务详情、完整预设编辑表单或复杂异常处理流程

**Given** workspace 加载数据
**When** loader 执行
**Then** 它只应加载总览所需摘要数据
**And** 不应同时承担任务详情、完整预设编辑模型或对应 mutation 所需数据

**Given** workspace 上存在任务或预设预览区块
**When** 创作者在该页面浏览内容
**Then** 页面必须将这些区块明确表现为摘要入口而非正式管理界面
**And** 不得继续在 workspace 内承载完整任务管理或完整预设管理职责

**Given** 团队准备在后续 stories 中建立 tasks 与 presets 正式路由
**When** 本 story 完成
**Then** workspace 的信息架构与数据边界必须已经收敛到总览角色
**And** 本 story 不以完成独立 tasks 或 presets 路由作为验收前提
```

Rationale:

- 直接消除 `Story 7.1` 对 `7.2 / 7.3` 的前向依赖
- 保留 `workspace` 收敛的用户价值
- 将“正式独立路由”的验收职责回归 `7.2 / 7.3`

### 4.2 Story Proposal - Add Story-level Requirement Traceability

Story: `epics.md` 全部 stories  
Section: Story metadata / requirement traceability

OLD:

```md
### Story 1.3: Manual Task Intake with Source Recognition Preview

As a 创作者,
I want 通过粘贴 YouTube 链接或上传视频创建任务并看到来源识别结果,
So that 我能在提交处理前确认系统识别到了正确的来源与关键设置。

**Acceptance Criteria:**
...
```

NEW:

```md
### Story 1.3: Manual Task Intake with Source Recognition Preview

**Implements:** FR1, FR2, FR3, FR7
**Supports:** UX-DR1, UX-DR7, UX-DR15, UX-DR16

As a 创作者,
I want 通过粘贴 YouTube 链接或上传视频创建任务并看到来源识别结果,
So that 我能在提交处理前确认系统识别到了正确的来源与关键设置。

**Acceptance Criteria:**
...
```

统一规则：

- 每个 story 必须至少包含一个 `Implements: FRx`
- 如 story 同时承接非功能、架构或 UX 要求，则补 `Supports: NFRx, ARx, UX-DRx`
- 不要求每条 AC 重复编号，但 story 头部必须可追踪

Rationale:

- 修复“只有 epic 级覆盖、没有 story 级责任归属”的缺陷
- 提高 dev / review / sprint planning / readiness 的可追踪性

### 4.3 Story Proposal - Assign Ownership for Currently Unowned AR / UX-DR

Story: `Epic 1 / Epic 5 / Epic 7`  
Section: requirement ownership redistribution

NEW:

```md
### Ownership Allocation for Currently Unowned Requirements

- Story 1.1 supports: AR16
- Story 1.2 supports: UX-DR17
- Story 1.5 supports: NFR1, NFR2, NFR3, UX-DR12, UX-DR15, UX-DR18
- Story 5.1 supports: UX-DR2, UX-DR3, UX-DR18
- Story 5.2 supports: UX-DR2, UX-DR3, UX-DR18
- Story 7.1 supports: UX-DR1, UX-DR17
- Story 7.3 supports: UX-DR14
- Story 7.4 supports: UX-DR4, UX-DR5, UX-DR6, UX-DR14, UX-DR18
```

最小补充验收方向：

- `Story 1.1`
  - 工程基线必须具备 `lint`、`typecheck`、`test`、`migration validation`、`build`
  - 为 `OpenAPI contract validation` 预留正式接入点
- `Story 5.1 / 5.2`
  - 关键路径在 mobile `<768px` 下可用
  - 触控目标至少 `44x44`
- `Story 7.4`
  - 样式预览使用统一 token 体系
  - 关键文本 / 状态对比度满足无障碍基线
  - 预览差异必须有文本辅助说明

Rationale:

- 先固定 ownership，再逐步细化 AC
- 避免再开一个无用户价值的“design foundation 技术 epic”

### 4.4 Epic Proposal - Mark Epic 7 as a Corrective Epic

Story: `Epic 7`  
Section: Epic introduction / execution note

OLD:

```md
## Epic 7: Product Information Architecture and Preset Editing Refactor

Epic 1-6 已实现 Yakimoji 的主要能力闭环，但当前前端实现把任务入口、任务列表、任务详情、预设列表、预设编辑和创建动作集中在 workspace 页面，导致产品信息架构不清、路由职责不稳定，并削弱了频道预设作为核心资产的编辑与预览体验。

本 Epic 不推翻既有业务能力，也不重写已完成 story 的历史语义。它作为交付后的纠偏 Epic，目标是在现有能力基础上重构产品承载方式：workspace 只承担工作入口和总览职责，任务与预设进入独立路由体系，预设编辑页提供模拟播放器和字幕样式预览，使后续维护、移动端适配和功能扩展建立在清晰边界上。
```

NEW:

```md
## Epic 7: Product Information Architecture and Preset Editing Refactor

Epic 1-6 已实现 Yakimoji 的主要能力闭环，但当前前端实现把任务入口、任务列表、任务详情、预设列表、预设编辑和创建动作集中在 workspace 页面，导致产品信息架构不清、路由职责不稳定，并削弱了频道预设作为核心资产的编辑与预览体验。

本 Epic 不推翻既有业务能力，也不重写已完成 story 的历史语义。它作为交付后的纠偏 Epic，目标是在现有能力基础上重构产品承载方式：workspace 只承担工作入口和总览职责，任务与预设进入独立路由体系，预设编辑页提供模拟播放器和字幕样式预览，使后续维护、移动端适配和功能扩展建立在清晰边界上。

**Execution Note:**
- 本 Epic 之所以允许与 Epic 1 / 2 的前端文件边界产生重叠，是因为它处理的是已交付后的信息架构纠偏，而不是初始设计阶段的普通功能拆分。
- 该重叠应被视为一次有明确业务理由的结构修正，而不是新 epic 设计的常规模式。
- 后续新增 epics 仍应优先遵循“按用户价值分组、避免在多个 epic 中反复改同一核心文件族”的规则。
```

Rationale:

- 将纠偏背景正式写回 `epics.md`
- 避免后续读者把 Epic 7 误解成无意义 file churn

## 5. Implementation Handoff

变更范围分类：**Moderate**

### Handoff Recipients

- Product Owner / Developer
  - 负责修订 `epics.md`
  - 负责重排 `Epic 7` story sequencing
  - 负责补齐 story-level traceability 与 requirement ownership

- Product Manager / Architect
  - 仅在需要把某些 AR / UX-DR 重新分配或重新定义时介入
  - 当前不需要重做 PRD 或 Architecture，只需确认修订后的分配没有偏离原目标

### Success Criteria

- `Story 7.1` 不再依赖未来 stories 才能验收完成
- 每个 story 都具有显式 requirement traceability
- `AR16`、`UX-DR3`、`UX-DR4`、`UX-DR5`、`UX-DR6` 不再悬空
- 修订后的 `epics.md` 重新通过 implementation readiness

### High-level Action Plan

1. 更新 `epics.md` 中 `Epic 7` 的开头说明与 `Story 7.1`
2. 为全部 stories 增加 `Implements:` / `Supports:` 字段
3. 为当前悬空的 `AR / UX-DR` 分配 story owner，并在必要 stories 中补验收条款
4. 重新运行 implementation readiness 检查

## 6. Checklist Status Summary

- `1.1` Triggering story identified: `[x] Done`
- `1.2` Core problem defined: `[x] Done`
- `1.3` Supporting evidence gathered: `[x] Done`
- `2.1` Current epic impact evaluated: `[x] Done`
- `2.2` Epic-level changes identified: `[x] Done`
- `2.3` Remaining epics reviewed for impact: `[x] Done`
- `2.4` Need for new epics evaluated: `[x] Done`
- `2.5` Epic order / priority impact evaluated: `[x] Done`
- `3.1` PRD conflict check: `[x] Done`
- `3.2` Architecture conflict check: `[x] Done`
- `3.3` UX conflict check: `[x] Done`
- `3.4` Secondary artifact impact check: `[x] Done`
- `4.1` Direct adjustment evaluated: `[x] Viable`
- `4.2` Rollback evaluated: `[x] Not viable`
- `4.3` MVP review evaluated: `[x] Not viable`
- `4.4` Recommended path selected: `[x] Done`
- `5.1` Issue summary created: `[x] Done`
- `5.2` Epic and artifact impact documented: `[x] Done`
- `5.3` Recommended path documented: `[x] Done`
- `5.4` MVP impact and action plan defined: `[x] Done`
- `5.5` Agent handoff plan established: `[x] Done`

## 7. Approval Request

本 Sprint Change Proposal 已根据增量审阅结果整理完成。

待确认事项：

- 是否批准按本 proposal 修订 `epics.md`
- 是否接受本次变更范围分类为 `Moderate`
- 是否在修订后重新执行 implementation readiness

## 8. Approval Outcome

用户已明确批准本 Sprint Change Proposal 用于实施。

- Approval: `yes`
- Scope classification: `Moderate`
- Required follow-up:
  - 修订 `epics.md`
  - 保留并排入 `Epic 7`
  - 重新执行 implementation readiness
