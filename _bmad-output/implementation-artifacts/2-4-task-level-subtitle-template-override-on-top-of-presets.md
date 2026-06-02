# Story 2.4: Task-level Subtitle Template Override on Top of Presets

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在保持预设默认值的前提下只对当前任务覆盖字幕模板,
so that 我能处理少量例外而不破坏长期复用规则。

## Acceptance Criteria

1. **Given** 某个任务已经命中已有频道预设、手动复用预设或基于新建最小预设继续  
   **When** 创作者查看任务创建确认区域  
   **Then** 页面必须允许创作者仅对当前任务覆盖字幕模板  
   **And** 该覆盖能力应明确表现为任务级例外，而不是修改底层频道预设
2. **Given** 创作者选择不同于预设默认值的字幕模板  
   **When** 创作者确认提交当前任务  
   **Then** 系统必须将该字幕模板作为当前任务生效值保存  
   **And** 原频道预设中的默认字幕模板不得被这次任务级操作隐式修改
3. **Given** 创作者没有选择任务级字幕模板覆盖  
   **When** 创作者继续创建任务  
   **Then** 系统必须继续采用预设默认字幕模板  
   **And** 不得要求创作者每次都重新确认或重新选择同一模板
4. **Given** 某个任务已经使用任务级字幕模板覆盖  
   **When** 创作者、支持或后续系统查看该任务详情  
   **Then** 系统必须能够明确区分该任务使用的是预设默认模板还是任务级覆盖模板  
   **And** 该覆盖记录应进入任务上下文与审计基础信息中
5. **Given** 创作者正在任务创建流程中执行字幕模板覆盖  
   **When** 页面展示可选模板与当前生效值  
   **Then** 页面必须以轻量方式展示选择结果与当前应用摘要  
   **And** 不得扩展成复杂字幕样式编辑器或开放超出范围的翻译风格等高级配置
6. **Given** 创作者尝试提交无效或不可用的字幕模板选择  
   **When** 系统执行校验  
   **Then** 页面必须返回清楚的错误提示  
   **And** 创作者可以重新选择有效模板后继续，而不需要重建整个任务
7. **Given** 任务带着任务级字幕模板覆盖进入后续处理链路  
   **When** 处理系统消费该任务配置  
   **Then** 系统必须将该任务的最终模板选择作为后续字幕生成与交付的正式输入  
   **And** 不得在进入处理后退回到预设默认模板而无可见说明

## Tasks / Subtasks

- [x] 扩展任务创建上下文，支持任务级字幕模板覆盖 (AC: 1, 2, 3, 4, 7)
  - [x] 为命中预设、手动复用预设和新建最小预设三种路径统一注入可选的 `subtitleTemplateOverride`
  - [x] 将最终生效模板与底层预设默认模板同时写入任务上下文，避免后续只能看到结果看不到来源
  - [x] 保持 `continue_without_preset` 路径不被误扩展为新的复杂配置面板
- [x] 在工作台任务确认区域提供轻量模板覆盖交互 (AC: 1, 3, 5, 6)
  - [x] 命中已有预设时展示当前默认字幕模板和可选覆盖模板
  - [x] 手动复用预设与新建最小预设时提供同样的任务级覆盖入口
  - [x] 页面文案明确说明这是只影响当前任务的例外设置，不会修改底层预设
- [x] 校验并应用任务级字幕模板覆盖 (AC: 2, 6, 7)
  - [x] 校验覆盖模板必须来自允许的轻量模板集合
  - [x] 覆盖存在时以任务级值写入 `processingBaselineSnapshot`
  - [x] 覆盖不存在时继续沿用预设默认模板，不要求重复确认
- [x] 在任务详情与审计上下文中暴露覆盖语义 (AC: 4, 7)
  - [x] 详情视图明确区分“沿用预设默认模板”与“任务级覆盖模板”
  - [x] 任务创建事件保留覆盖是否生效的审计上下文，便于后续支持与排障
- [x] 补齐回归测试与构建验证 (AC: 2, 3, 4, 6, 7)
  - [x] 覆盖命中预设、手动复用预设和无覆盖沿用默认三类路径
  - [x] 覆盖无效模板选择的校验与错误保留
  - [x] 保持 `pnpm typecheck`、`pnpm test`、`pnpm build` 通过

### Review Follow-ups (AI)

- [x] [AI-Review][Critical] 任务确认提交失败后，`preview` 会被前端直接清空，匹配预设卡片和任务级模板覆盖入口一起消失，未满足 AC6 要求的“报错后可以重新选择有效模板继续”。`app/shared/ui/WorkspaceShell.tsx:230`
- [x] [AI-Review][Critical] 服务端没有拒绝 `confirm_continue_without_preset` 携带的 `subtitleTemplateOverride`；该值不会写入 `processingBaselineSnapshot`，却会被写进 `sourceSnapshot.taskLevelOverrides`，后续详情页还会把它解释成“任务级字幕模板覆盖”，造成 AC1/AC7 所要求的 preset-backed scope 和正式处理输入彼此矛盾。`app/features/tasks/server/task-intake.server.ts:555`
- [x] [AI-Review][Medium] 回归测试覆盖了 matched / manual reuse / manual create 的 override 场景，但没有验证 `continue_without_preset` 必须拒绝 override，也没有验证前端在确认失败后仍保留覆盖上下文。`tests/task-intake.test.ts:257`
- [x] [AI-Review][Medium] Story File List 漏记了实际参与本 story 的 `app/features/tasks/server/task-errors.server.ts` 与 `app/features/tasks/server/task-events.server.ts` 变更，审计追踪不完整。`_bmad-output/implementation-artifacts/2-4-task-level-subtitle-template-override-on-top-of-presets.md:113`

## Dev Notes

### Story Intent

- 本 story 只做“任务级字幕模板覆盖”，且只建立在已有预设来源之上，不扩展成新的高级配置后台。
- 预设默认值仍是长期复用规则真源；任务级覆盖只是当前任务的临时例外。
- 覆盖信息必须进入任务上下文，不能只在前端临时态中生效。

### Architecture Compliance

- 任务创建后的最终处理输入仍以 `processingBaselineSnapshot` 为准，因此任务级字幕模板覆盖必须直接体现在该快照中。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md]
- 任务详情与支持语义需要能解释“为什么当前任务的字幕模板与预设默认不同”，因此至少要同时保留预设默认来源与任务级覆盖结果。
- 维持现有 `preview -> confirm` 模式，不新增复杂表单步骤或独立管理页面。

### UX Constraints

- 覆盖交互必须轻量，只展示当前默认模板、可选覆盖模板与结果摘要，不延展成字幕样式编辑器。[Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md]
- 文案必须明确“只影响当前任务，不会修改频道预设”，避免创作者误以为自己在编辑长期规则。
- 错误提示保持内联，并保留当前任务创建上下文。

### Current Codebase State

- Story 2.3 已将未知来源的三种预设决策统一收敛到 `task-intake.server.ts` 的确认分支。
- `processingBaselineSnapshot.subtitleTemplate` 已是后续链路读取的最终模板字段，适合作为任务级覆盖的正式输入。
- `WorkspaceShell.tsx` 已有命中确认卡与陌生频道决策面板，可在这些确认表单中插入轻量模板覆盖字段。
- `task-query.server.ts` 和 `TaskStatusSummaryCard.tsx` 已开始展示预设来源语义，可继续补充模板覆盖来源语义。

### Testing Requirements

- 扩展 `tests/task-intake.test.ts`，覆盖命中预设覆盖、手动复用覆盖、沿用默认、无效模板四类路径。
- 扩展 `tests/task-query.test.ts`，验证详情可读地区分预设默认模板与任务级覆盖模板。
- 完成后运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 65 tests.
- `pnpm build` passed.

### Completion Notes

- Added lightweight subtitle template override controls to preset-backed task confirmation flows only.
- Persisted task-level subtitle overrides into task source snapshots while keeping preset defaults intact.
- Surfaced readable subtitle template provenance in task detail so support and creators can distinguish default vs override.

### File List

- `_bmad-output/implementation-artifacts/2-4-task-level-subtitle-template-override-on-top-of-presets.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/features/tasks/task-intake.shared.ts`
- `app/features/tasks/server/task-errors.server.ts`
- `app/features/tasks/server/task-events.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/features/tasks/server/task-query.server.ts`
- `app/features/tasks/components/TaskStatusSummaryCard.tsx`
- `app/shared/ui/WorkspaceShell.tsx`
- `tests/task-intake.test.ts`
- `tests/task-query.test.ts`
- `tests/workspace-shell.test.ts`
- `tests/workspace-view.test.ts`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-02

Findings:

- 已修复确认失败后 preview 丢失的问题，任务级模板覆盖上下文会在报错后保留。`app/shared/ui/WorkspaceShell.tsx:196`
- 已阻止 `continue_without_preset` 非法携带 `subtitleTemplateOverride`，任务级覆盖现在只允许发生在预设支撑的路径中。`app/features/tasks/server/task-intake.server.ts:239`
- 已补齐对应回归测试与 story 文件追踪。`tests/task-intake.test.ts:313`

Decision:

- Approve。前序 review follow-ups 已全部修复并验证通过，Story 状态更新为 `done`。

### Change Log

- 2026-06-02: Story artifact created from Epic 2 / Story 2.4 context.
- 2026-06-02: Implemented, reviewed, and completed task-level subtitle template override.
- 2026-06-02: BMAD review completed with Changes Requested; status reverted to in-progress and follow-up items added.
- 2026-06-02: Addressed AI review follow-ups for preset-backed override enforcement, preview retention, regression coverage, and story file tracking; status returned to review.
- 2026-06-02: Review follow-ups verified as resolved; story marked done.
