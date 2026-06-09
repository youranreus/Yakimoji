# Story 5.2: Mobile Low-confidence Approve or Reopen Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在移动端完成最小必要的低置信度处理动作,
so that 我不在桌面前时也能推动任务继续执行。

## Acceptance Criteria

1. **Given** 某个任务因低置信度片段进入等待人工确认状态  
   **When** 创作者在移动端打开该任务  
   **Then** 页面必须明确标识该任务当前需要人工确认  
   **And** 该状态必须与普通处理中或失败状态清楚区分
2. **Given** 创作者在移动端进入待确认任务详情  
   **When** 页面加载 review 内容  
   **Then** 创作者必须能够查看待确认的低置信度片段及其必要上下文  
   **And** 这些信息必须在移动端屏幕上以可读、可操作的方式呈现
3. **Given** 创作者在移动端查看某个待确认片段  
   **When** 创作者执行确认或处理动作  
   **Then** 系统必须保存该确认结果  
   **And** 该操作必须与具体任务和对应片段建立可追踪关联
4. **Given** 移动端进入低置信度确认场景  
   **When** 系统展示可用动作  
   **Then** 移动端只要求支持轻量确认、驳回重开或等价最小动作  
   **And** 本 story 不要求在移动端支持复杂文本编辑、逐句重写、波形编辑或长时间轴精修
5. **Given** 当前任务的全部待确认片段都已在移动端完成处理  
   **When** 系统确认 review 条件满足  
   **Then** 任务必须能够继续推进后续处理链路  
   **And** 创作者不需要回到桌面端重新执行同一确认流程
6. **Given** 创作者在移动端进行低置信度确认  
   **When** 页面提供操作入口  
   **Then** 交互必须优先支持轻量确认与继续推进  
   **And** 不得把移动端确认流程扩展成复杂逐句编辑器或超出第一阶段边界的重编辑体验
7. **Given** 移动端确认流程中出现提交失败、网络问题或数据失效  
   **When** 系统无法完成保存  
   **Then** 页面必须返回明确错误提示并保留当前任务上下文  
   **And** 创作者可以重试，而不需要重新进入整个任务流程
8. **Given** 创作者通过移动端完成确认  
   **When** 后续系统、支持或审计读取该任务上下文  
   **Then** 这些移动端确认记录必须与桌面端确认记录一样被正式保存  
   **And** 不得因设备来源不同而丢失 review 审计信息
9. **Given** 团队验证移动端支持范围  
   **When** 执行最低支持矩阵验证  
   **Then** 至少应覆盖一组 iPhone Safari 与一组 Android Chrome 的关键动作  
   **And** 不使用在移动端表现良好这类不可测试表述作为验收标准

## Tasks / Subtasks

- [x] 在移动端任务列表与详情中强化“待人工确认”状态入口，明确区分 review / processing / failed (AC: 1, 2, 6)
  - [x] 保持 `awaiting_human_review` 继续来自统一任务状态真源，不为移动端发明第二套 review 状态
  - [x] 在任务列表卡片、详情摘要或 review callout 中突出“当前需要人工确认”的事实与后续动作，不把它埋在时间线或次级说明里
  - [x] 继续复用 5.1 已建立的移动端 follow-through 布局，不把 review 处理挤回桌面生产区块之后

- [x] 将 `TaskReviewQueueCard` 收敛为移动端轻量确认界面，而不是桌面式长表单 (AC: 2, 4, 6)
  - [x] 让每个待确认片段优先呈现片段内容、必要上下文、当前置信提示与最小动作
  - [x] 把“确认继续 / 需要继续关注或等价重开动作”做成移动端可直接点击的轻量控制，而不是依赖复杂下拉与长备注输入作为主路径
  - [x] 备注或补充说明若保留，必须降级为可选辅助输入，不能成为阻塞主路径的复杂编辑器

- [x] 保持移动端 review 提交的正式持久化与上下文保留语义 (AC: 3, 5, 7, 8)
  - [x] 继续通过现有 `submit_review` action / `task.review_resolved` event / `task_events` 账本保存正式决策，不新增一套 mobile-only review API
  - [x] 对提交失败、校验失败、任务状态失效或网络中断场景，显式保留当前片段列表与用户已选决策/输入
  - [x] 成功提交后仍由既有状态推进链路处理后续 `queued -> processing` 或等价流程，不要求创作者回桌面重复确认

- [x] 用可测试的方式定义“驳回重开或等价最小动作”的移动端实现语义 (AC: 4, 5, 8)
  - [x] 若沿用现有 `needs_attention` 决策值，必须在 UI 文案、帮助说明和测试中明确它在移动端对应的业务含义
  - [x] 若引入新的轻量交互文案或提交映射，必须保持审计/事件 payload 与既有 contract 一致或可兼容解析
  - [x] 不得把 5.2 扩 scope 成新的 retry/failure 恢复 story，也不得在这里引入复杂逐句编辑

- [x] 补齐移动端 review 提交的测试与最低支持矩阵证据 (AC: 1, 2, 3, 5, 7, 8, 9)
  - [x] 新增 server 或 action 层测试，覆盖 `submit_review` 成功、校验失败、状态失效和上下文保留语义
  - [x] 新增 UI/结构测试，锁定移动端 review 卡的轻量动作入口、错误反馈和小屏排版约束
  - [x] 若本地鉴权条件允许，至少用 Browser 插件或等价手段记录一组 iPhone Safari 尺寸与一组 Android Chrome 尺寸的关键动作验证；若环境受限，必须在 Completion Notes 明确记录阻塞原因
  - [x] 至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`

## Dev Notes

### Story Intent

- 5.2 的目标不是发明一套新的 review 域模型，而是在 3.1 既有 review contract 上，把移动端动作收敛为“轻量确认、轻量继续关注/等价重开动作、失败可重试”的最小闭环。
- 这是一条 follow-through story，不是失败恢复 story，也不是字幕编辑 story。
- 5.1 已经把移动端列表/详情/下载主路径压到前景；5.2 只在这个新布局上补“可完成必要人工确认”。

### Business and Epic Context

- Epic 5 的业务承诺是：创作者离开桌面后仍能在手机上维持任务连续性，必要时推进人工确认，不被迫回桌面“只为点一下继续”。
- 5.2 直接承接 3.1 的低置信度确认能力，但必须做移动端职责收敛，不允许变成微型字幕编辑器。
- 如果 5.2 只是把 3.1 的桌面表单原样塞进手机宽度，而没有把动作、上下文和错误恢复收敛成轻量路径，就不满足 Epic 5 的移动端范围。

### Dependencies

- 直接依赖 Story 5.1 已建立的移动端 follow-through 壳层与断点：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/5-1-mobile-task-visibility-and-deliverable-access.md`
  - `app/shared/ui/WorkspaceShell.tsx`
  - `app/app.css`
  - `app/features/tasks/components/TaskListPanel.tsx`
  - `app/features/tasks/components/TaskDetailPanel.tsx`
- 直接依赖 Story 3.1 的 review queue 与提交基础：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/3-1-low-confidence-review-queue-for-creators.md`
  - `app/features/tasks/components/TaskReviewQueueCard.tsx`
  - `app/features/tasks/server/task-intake.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`
  - `app/features/tasks/server/task-query.server.ts`
- 依赖 Story 3.0 的共享 review contract：
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/3-0-review-failure-retry-and-diagnostic-contract-setup.md`

### Current Codebase State

- `TaskReviewQueueCard.tsx` 当前已经可以：
  - 展示待确认片段列表
  - 展示前文/后文/建议动作
  - 通过 `fetcher.Form` 批量提交 review
  - 失败时展示 inline error
  - 成功时展示 inline success
- 但当前 review 卡仍明显偏桌面表单风格：
  - 每个片段使用 `select` + `textarea`
  - 提交动作是全局单按钮
  - 没有为移动端把主要动作压缩成“一眼能点”的轻量确认入口
- `submitTaskReview()` 当前已具备正式持久化链路：
  - 校验 `taskId`
  - 校验任务归属与状态
  - 从 `task_events` 提取 review queue
  - 接收 `approve` / `needs_attention`
  - 通过 `transitionTaskStatus()` 写入 `task.review_resolved`
  - 把任务推进到 `queued`
  - 因此 5.2 不需要新建 mobile-only review API
- `extractReviewQueue()` 当前已能从 `task.review_required` / `task.human_review_requested` 事件恢复：
  - `reviewId`
  - `summary`
  - `items[]`
  - `pendingCount`
  - `resolvedDecisions`
- `TaskDetailPanel.tsx` 当前已把 `TaskReviewQueueCard` 放在详情卡栈较前位置，适合继续复用为移动端 follow-through 主模块。
- 当前测试存在明显缺口：
  - 有 review queue read-model 测试
  - 但几乎没有 `submit_review` action 成功/失败/上下文保留的专门测试
  - 也没有移动端 review 卡的结构性约束测试

### Architecture Compliance

- 继续遵守 `AR10`：顶层任务状态统一，review 只是显式人工介入路径，不是新的顶层状态体系。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`]
- 继续遵守 `AR12`：人工介入必须建模为显式 review 资源或 action endpoint。5.2 只能复用既有 `submit_review` action / event contract，不得临时在组件里做本地假提交。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`]
- 继续遵守 `AR11`：移动端状态更新仍靠现有 loader + SSE/polling revalidation，而不是客户端私有状态机。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`]
- 继续遵守 domain-first 结构：review UI 变化优先留在 `app/features/tasks/components/TaskReviewQueueCard.tsx` 与相关 task feature helper，不新增平行移动端领域目录。

### UX and Interaction Guardrails

- 5.2 必须坚持“轻量确认，而不是重编辑器”。最主要动作应该是一眼可见、单手可点，而不是长表单或深层控件。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-5.2`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Responsive-Design--Accessibility`]
- review 卡必须让用户立即理解：
  - 为什么现在需要人工确认
  - 当前片段是什么
  - 可以做什么最小动作
  - 提交失败后应该怎么继续
- 移动端上下文只保留必要判断信息：片段、前后文、提示语、当前动作。不要在 5.2 把备注、长文本修订或复杂时间轴提升为主路径。
- 错误反馈必须内联、明确、可重试；不能把失败变成 toast 一闪而过或提交后整页跳回列表。

### File Structure Requirements

- 优先修改：
  - `app/features/tasks/components/TaskReviewQueueCard.tsx`
  - `app/features/tasks/components/TaskDetailPanel.tsx`
  - `app/features/tasks/components/task-formatters.ts`（若需要提取 review 辅助 copy）
  - `app/features/tasks/server/task-intake.server.ts`
  - `app/features/tasks/server/task-diagnostics.server.ts`（仅当需要稳定映射或读模型帮助器）
  - `app/app.css`
  - `tests/task-intake.test.ts`
  - `tests/task-query.test.ts`
  - `tests/e2e/workspace-shell.test.mjs` 或新增同级最小结构测试
- 不要新增：
  - `mobile-review.server.ts`
  - 独立 `app/routes/mobile-review.*`
  - 第二套 review event payload

### Testing Requirements

- 必须覆盖：
  - `awaiting_human_review` 在移动端 follow-through 入口中的显式状态表达
  - `submit_review` 成功时写入正式决策并返回 `review_submitted`
  - `submit_review` 校验失败或任务失效时返回明确错误
  - 提交失败后，当前片段列表与用户已选动作不会丢失
  - `needs_attention` 或等价最小动作的移动端语义是可测试且可追踪的
  - 小屏 review 卡不依赖 hover 或复杂输入才能完成核心动作
- 优先扩展：
  - `tests/task-intake.test.ts`
  - `tests/task-query.test.ts`
  - `tests/e2e/workspace-shell.test.mjs`
  - 如需要，可新增 `tests/task-review-card.test.ts` 或等价轻量单测
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### Previous Story Intelligence

- Story 5.1 已把移动端的任务同步、列表和详情提到前景，并且补了显式跳转入口；5.2 必须继续在这条可达路径上承接 review，不要重新把用户推回低优先级桌面生产区块。
- Story 3.1 已证明：
  - review queue / detail / submit action 基本链路可用
  - 失败时应保留上下文
  - 但它没有针对手机交互做动作压缩
- Story 1.5 / 1.7 已证明：
  - route-driven detail 和内联状态说明是 Yakimoji 的固定工作台模式
  - 5.2 不能用 modal-heavy 或 detached wizard 风格替代现有详情内联处理

### Git Intelligence Summary

- 最近提交仍是保守增量修正风格：
  - `764d745 chore: mark epic 1 done in sprint status`
  - `851abcc fix: remove internal copy from user-facing pages`
  - `806b510 use single png favicon asset`
  - `88f2d46 fix sso login and workspace access`
  - `14c832e fix: add favicon asset handling`
- 这意味着 5.2 更适合在现有 review card / action / tests 上收敛，不适合做新的多步 flow 或独立页面。

### Latest Technical Information

- 截至 **2026-06-09**，React Router 官方当前文档仍把 `useFetcher` 定位为“不引发导航、但仍通过 route action/loader 参与正式数据写入与重验证”的机制。
  - 这与当前 `TaskReviewQueueCard -> fetcher.Form -> submit_review action` 模型完全一致，5.2 应继续沿用，而不是自己手写客户端 `fetch()` 和本地假成功状态。[Official: `https://reactrouter.com/api/hooks/useFetcher`, `https://reactrouter.com/start/framework/actions`]
- 截至 **2026-06-09**，W3C / MDN 仍强调移动端交互目标需要清楚的触控尺寸、结构化标签与错误恢复路径。
  - 5.2 的主要 review 动作应优先做成可直接点击的主按钮或等价轻量控件，而不是要求用户先操作细小下拉框或长文本输入。[Official: `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`, `https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Mobile_accessibility_checklist`]

### Project Context Reference

- 通过 workflow `persistent_facts` 约定的 `project-context.md` 全仓扫描未找到匹配文件。
- 当前有效项目上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - 已完成的 3.0、3.1、5.1 implementation artifacts

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-5.2`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Responsive-Design--Accessibility`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/3-0-review-failure-retry-and-diagnostic-contract-setup.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/3-1-low-confidence-review-queue-for-creators.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/5-1-mobile-task-visibility-and-deliverable-access.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/TaskReviewQueueCard.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/TaskDetailPanel.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-diagnostics.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-query.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/app.css`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-query.test.ts`]
- [Official: `https://reactrouter.com/api/hooks/useFetcher`]
- [Official: `https://reactrouter.com/start/framework/actions`]
- [Official: `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`]
- [Official: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Mobile_accessibility_checklist`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Loaded Epic 5 Story 5.2 requirements, Story 5.1 outcome, current review queue UI/action code, and existing tests before authoring.
- Verified current official guidance for `useFetcher`-based non-navigation mutations and mobile accessibility constraints before locking implementation guardrails.
- Implemented mobile-first review decisions with preserved draft state, explicit `needs_attention` helper copy, and responsive card controls instead of the previous select-heavy form path.
- Repaired the task-intake fake DB chain so `submit_review` tests cover the real `getTaskForUser` and review transition query shapes.
- Validation results: `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed locally.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created for Story 5.2 mobile review follow-through implementation.
- Reworked `TaskReviewQueueCard` into a mobile-first confirmation flow with direct “确认继续 / 继续关注” controls, optional note disclosure, inline retry feedback, and preserved draft state after failed submissions.
- Kept mobile review persistence on the existing `submit_review` -> `task.review_resolved` -> `queued` transition contract, without introducing a parallel mobile-only API or event payload.
- Added helper copy plus unit coverage so `needs_attention` is explicitly presented as the mobile “继续关注” action while remaining audit-compatible with the existing review ledger.
- Added action-level regression coverage for `submit_review` success and invalid-decision failures, and hardened the local fake DB query chain to match the real Drizzle call shapes used by review submission.
- Local authenticated viewport verification remains blocked: without a creator session, `/workspace` redirects to `/login`, so iPhone Safari and Android Chrome task-review actions could not be visually exercised in-browser in this environment.

### File List

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/5-2-mobile-low-confidence-approve-or-reopen-flow.md`
- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/app.css`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/TaskReviewQueueCard.tsx`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/task-formatters.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/task-review-drafts.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-formatters.test.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-review-drafts.test.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts`
- `/Users/reuszeng/Code/Projects/Yakimoji/tsconfig.vite.tsbuildinfo`

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-06-09

Findings:

- Performed a three-angle BMAD review against the Story 5.2 spec, implementation diff, and task-review test coverage.
- No decision-needed, patch, or defer findings remained after triage.
- Re-validated the story with `pnpm typecheck`, `pnpm test`, and `pnpm build`; all passed.

Decision:

- Approve. Story 5.2 satisfies the mobile low-confidence review scope without introducing a parallel review model, and the regression coverage now locks the submission path plus preserved-context behavior.

### Change Log

- 2026-06-09: Created Story 5.2 implementation context and marked it ready for development.
- 2026-06-09: Implemented the mobile low-confidence review follow-through flow, added regression coverage, validated with `pnpm typecheck`, `pnpm test`, and `pnpm build`, and moved the story to `review`.
- 2026-06-09: Completed BMAD code review with a clean outcome, confirmed validation remained green, and moved the story to `done`.
