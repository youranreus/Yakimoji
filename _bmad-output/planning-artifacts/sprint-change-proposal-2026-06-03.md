# Sprint Change Proposal - Epic 3 Contract-First Adjustment

Date: 2026-06-03
Project: Yakimoji
Trigger Source: Epic 2 retrospective (`epic-2-retro-2026-06-03.md`)
Mode: Batch

## 1. Issue Summary

Epic 2 retrospective did not reveal a missing Epic 2 feature. It revealed that Epic 3 is about to start on top of incomplete cross-story contracts for review, failure explanation, retry semantics, and support diagnostics.

The trigger evidence is concrete:

- Story 2.3 and Story 2.4 both exposed the same class of front-end failure: failed confirm actions could clear the current preview or decision context.
- Epic 3 depends more heavily than Epic 2 on state continuity, because review handling, failure explanation, retry, and support diagnostics all require stable context retention.
- Architecture already says human intervention should be modeled through explicit review resources or action endpoints, unified top-level task states, `task_events`, and local RBAC. Epic 3 stories currently do not lock those contracts before UI work begins.
- UX specification currently describes richer recovery choices than the Epic 3 MVP stories actually define, which creates an implementation ambiguity before development starts.

Problem statement:

Epic 3 needs a contract-first preparation gate before story implementation. Without that gate, Story 3.1, 3.2, and 3.3 are likely to invent inconsistent review resources, event payloads, failure taxonomies, retry behavior, and support-visible fields.

## 2. Impact Analysis

### Epic Impact

- Epic 2: no rollback required; retrospective findings become explicit entry conditions for Epic 3.
- Epic 3: directly affected. Sequencing and acceptance criteria need adjustment before implementation starts.
- Epic 4: indirectly affected because API status and failure contracts depend on Epic 3 state, reason-code, and retry semantics.
- Epic 6: indirectly affected because support/audit field definitions should align with Epic 3 diagnostic and event contracts.

### Story Impact

- Story 3.1 is underspecified on review resource shape, stable identifiers, failed-submit context retention, and event emission.
- Story 3.2 is underspecified on failure taxonomy, retry lineage, carry-forward rules, and immutable history guarantees.
- Story 3.3 is underspecified on support-visible minimum fields, permission boundary tests, and event-to-timeline mapping.
- Story 4.2 and 4.3 need alignment with the eventual retry and failure contracts.
- Story 6.2 should be aligned with the same event and diagnostic minimum field set.

### Artifact Conflicts

#### PRD

The PRD already contains the right product intent in FR26-FR33 and FR50, but it does not explicitly state:

- review item / decision traceability requirements
- retry attempt lineage requirements
- minimum diagnostic identifier requirements
- the exact relationship between creator-facing explanation and support-facing diagnostic fields

This is a clarification gap, not a scope gap.

#### Architecture

Architecture already points in the correct direction:

- unified task status model
- `task_events` for fine-grained progression
- explicit review resources or action endpoints
- local RBAC as the only authorization truth

But it does not yet fully lock:

- the attempt model for retry
- the minimum event payload shape for review and retry
- the minimum support diagnostic field contract
- the canonical carry-forward rules from failed task context into a new attempt

#### UX

The UX specification has a concrete mismatch with Epic 3 MVP scope:

- the current failure recovery flow shows multiple recovery paths such as retry current step, adjust rules, switch preset, and later handling
- Story 3.2 only commits MVP to retry-to-new-attempt recovery

If left unresolved, design and implementation may diverge immediately.

### Technical Impact

Likely implementation artifacts affected:

- data model: add or formalize `review_items`, review decisions, and `task_attempts` or equivalent lineage structure
- event contract: add stable review and retry event payloads
- API contract: align external failure/status semantics with internal state and attempt model
- RBAC rules: define support diagnostic authorization separately from creator ownership
- front-end state handling: preserve current review/failure context after rejected submit or retry attempts

## 3. Recommended Approach

### Option Evaluation

#### Option 1: Direct Adjustment

- Viable: Yes
- Effort: Medium
- Risk: Medium-Low

Assessment:

- add a preparation story or preparation task group before Story 3.1
- tighten Story 3.1, 3.2, and 3.3 acceptance criteria
- align Epic 4 and Epic 6 contract consumers after Epic 3 contract setup

This resolves the retrospective finding without changing product direction.

#### Option 2: Potential Rollback

- Viable: No
- Effort: High
- Risk: High

Assessment:

- Epic 2 delivered the intended value and the issue is not wrong functionality
- rollback would destroy stable preset/task snapshot work that Epic 3 actually depends on

#### Option 3: PRD MVP Review

- Viable: Partially, but unnecessary as the primary path
- Effort: Medium
- Risk: Medium

Assessment:

- MVP is still achievable
- the issue is not that the MVP goal is wrong; the issue is that implementation sequencing is too loose

### Recommended Path

Choose Option 1: Direct Adjustment, with contract-first sequencing.

Rationale:

- preserves MVP scope
- addresses the exact integration risk revealed by Epic 2
- avoids predictable divergence between UI, events, API, support diagnostics, and audit history
- keeps Epic 3, Epic 4, and Epic 6 coherent without triggering a full replan

Timeline impact:

- add one preparation step before Epic 3 UI-heavy work
- expect a short delay at Epic 3 start, but lower rework risk across three stories and two downstream epics

## 4. Detailed Change Proposals

### A. Epic / Story Changes

#### Change A1: Insert Epic 3 preparation story

Artifact: `epics.md`

OLD:

- Epic 3 starts directly with Story 3.1, Story 3.2, and Story 3.3.

NEW:

- Insert a preparation story before Story 3.1:

```text
Story 3.0: Review, Failure, Retry, and Diagnostic Contract Setup

As a 开发团队,
I want 在 Epic 3 功能开发前先锁定 review、failure、retry 和 support diagnostic 的共享契约,
So that 后续故事可以实现一致的资源模型、事件语义和权限边界。
```

Proposed acceptance criteria:

- Define the canonical review resource or action endpoint model, including stable IDs for task, review item, segment, decision, actor, and decision status.
- Define the failure phase taxonomy, machine-readable reason codes, and user-readable reason descriptions.
- Define retry as a new attempt or equivalent new execution instance, with immutable historical failure context.
- Define carry-forward rules for source snapshot, preset snapshot, subtitle override, and review decisions.
- Define the minimum support diagnostic field set and authorization rule.
- Define `task_events` payload requirements for `task.review_required`, `task.review_resolved`, `task.failed`, and retry creation.
- Produce contract examples and test targets before UI-heavy implementation starts.

Rationale:

- this turns retrospective entry conditions into an explicit deliverable
- it prevents each Epic 3 story from inventing its own semantics

#### Change A2: Tighten Story 3.1 acceptance criteria

Artifact: `epics.md`

OLD:

- Story 3.1 requires creators to view low-confidence items and submit confirmations.

NEW:

- Add these acceptance criteria:

```text
Given 创作者正在处理低置信度确认
When 提交确认动作失败或被后端拒绝
Then 当前 review 上下文、片段列表和已输入决策必须保留
And 不得把创作者重置回任务起点或清空当前确认语境

Given 某个 review item 被加载或提交
When 系统读写该人工确认数据
Then 每个 review item、segment 和 decision 必须使用稳定标识
And 系统必须能把确认记录与 task_events 中的 review 事件关联

Given 当前任务的待确认片段被全部处理
When 系统确认 review 已完成
Then 系统必须记录明确的 review resolved 事件
And 任务后续推进不得依赖前端临时状态拼接
```

Rationale:

- directly addresses the repeated context-loss bug class from Epic 2
- binds Story 3.1 to the shared review contract instead of UI-local state

#### Change A3: Tighten Story 3.2 acceptance criteria

Artifact: `epics.md`

OLD:

- Story 3.2 requires failure explanation and retry-to-new-attempt recovery.

NEW:

- Add these acceptance criteria:

```text
Given 某个失败任务允许恢复
When 创作者选择重试
Then 系统必须创建新的 attempt 或等价执行实例
And 原失败 attempt 的失败阶段、原因、诊断标识和相关时间线必须保持可查询且不可被静默改写

Given 某个重试 attempt 被创建
When 系统决定携带哪些上下文进入新 attempt
Then 来源快照、预设快照、任务级字幕覆盖和已确认 review 决策的继承规则必须是显式定义的
And 不得依赖隐式默认行为

Given 创作者触发 retry 动作
When 该动作失败或被拒绝
Then 失败解释模块和当前可用恢复动作必须保持稳定可见
And 不得因为前端临时状态丢失而让用户失去当前失败语境

Given 某个任务显示失败阶段与原因
When 系统渲染这些信息
Then 阶段分类与 reason code 必须来自共享失败 taxonomy
And 不得由单个 story 局部发明新的异常语义
```

Rationale:

- ensures retry does not mutate history
- aligns creator-facing recovery with API and audit needs

#### Change A4: Tighten Story 3.3 acceptance criteria

Artifact: `epics.md`

OLD:

- Story 3.3 requires support timeline and diagnostic context.

NEW:

- Add these acceptance criteria:

```text
Given 支持人员查看任务诊断信息
When 系统展示支持视图
Then 最小字段集至少包含 preset match/no-match 结果、manual preset decision、subtitle override、review required/resolved、failure phase、reason code、request_id 或等价诊断标识、retry attempt lineage 和关键 task_events 时间线
And 这些字段必须来自共享契约而不是页面临时拼装

Given 支持人员访问诊断视图
When 系统执行授权检查
Then support 访问规则必须与 creator ownership 分离定义并可测试
And 不得因为支持视图存在而放宽任务、交付物或审计上下文的权限边界
```

Rationale:

- converts vague “support can explain” into testable field and permission requirements

#### Change A5: Align downstream Epic 4 and Epic 6 stories

Artifacts: `epics.md`

OLD:

- Story 4.2, 4.3, and 6.2 already rely on status, failure, and history semantics, but do not explicitly depend on Epic 3 contract setup.

NEW:

- Add dependency notes:
  - Story 4.2 and 4.3 consume the shared status, failure taxonomy, attempt lineage, and request ID semantics defined in Epic 3 preparation.
  - Story 6.2 consumes the same review, failure, retry, and diagnostic minimum field contract.

Rationale:

- prevents downstream stories from re-defining the same concepts

### B. PRD Clarifications

#### Change B1: Clarify review, failure, diagnostic, and audit requirements

Artifact: `prd.md`
Section: `Review & Exception Handling`, `Operations & Minimal Administrative Visibility`

OLD:

- FR28: 创作者可以对低置信度片段进行确认或处理，并让任务继续推进。
- FR31: 支持人员可以查看任务处理失败或中断的原因分类。
- FR32: 支持人员可以查看任务处理过程中的关键时间线与上下文信息。
- FR33: 支持人员可以查看任务曾使用的人工覆盖与人工确认记录。
- FR50: 系统可以为任务提供最小审计记录...

NEW:

- FR28 clarification:
  - 人工确认记录至少应关联 review item / segment、decision、actor、timestamp，并能被任务历史与支持诊断复用。
- FR31 clarification:
  - 原因分类同时包含稳定 machine-readable reason code 与 user-readable explanation。
- FR32 clarification:
  - 关键时间线至少覆盖 preset match/no-match、manual decision、review required/resolved、failure、retry attempt creation、delivery outcome。
- FR33 clarification:
  - 人工覆盖与人工确认记录必须可定位到任务上下文和具体发生时间。
- FR50 clarification:
  - 最小审计记录增加 attempt lineage、failure diagnostic identifier、review resolution evidence。

Rationale:

- the PRD remains within current MVP scope
- these are precision upgrades, not product direction changes

### C. Architecture Changes

#### Change C1: Formalize review and retry domain model

Artifact: `architecture.md`
Sections: `Data Architecture`, `Human Review Communication Model`, `Task Status Model`, `SSE Event Contract`

OLD:

- architecture recommends explicit review resources and `task_events`
- retry attempt model is not explicitly locked

NEW:

- Add or clarify the following:

```text
Canonical review model
- review_items(id, task_id, segment_ref, status, required_at, resolved_at)
- review_decisions(id, review_item_id, decision, actor_id, decided_at, notes?)

Canonical retry / attempt model
- task_attempts(id, task_id, attempt_number, source_attempt_id?, status, failure_phase?, reason_code?, request_id?, created_at)
- failed attempts remain queryable and immutable after a new attempt is created

Event payload minimum
- task.review_required: task_id, review_item_ids, status, occurred_at, payload
- task.review_resolved: task_id, review_item_ids, actor_id, occurred_at, payload
- task.failed: task_id, attempt_id, failure_phase, reason_code, request_id, occurred_at, payload
- task.retry_created: task_id, new_attempt_id, previous_attempt_id, carried_context_summary, occurred_at, payload
```

Also add:

- support diagnostic minimum field set as an architecture-level contract
- explicit note that support authorization is checked through local RBAC, not creator ownership fallback

Rationale:

- architecture currently points at the right pattern but stops short of a consumable contract

#### Change C2: Update architecture diagrams / component notes

Artifact: `architecture.md`
Sections: `Runtime Topology`, `Background Processing Boundary`

OLD:

- worker, postgres, SSE, and audit boundaries are described at a high level

NEW:

- clarify that `background-worker` writes `task_events`, review state transitions, attempt lineage, and failure metadata consumed by:
  - creator workspace
  - support diagnostics
  - external API
  - audit/history views

Rationale:

- makes the cross-consumer dependency visible before story implementation starts

### D. UX Specification Changes

#### Change D1: Align failure recovery flow with MVP retry semantics

Artifact: `ux-design-specification.md`
Section: `自动化失败后的解释与恢复`

OLD:

- flow suggests multiple direct recovery branches: retry current step, adjust rules, switch preset, later handling

NEW:

- update MVP wording to:
  - primary recovery action is retry as a new attempt when recovery is allowed
  - other actions such as adjusting rules or switching preset are deferred unless explicitly approved for a failure category
  - failed retry submission must preserve the visible failure explanation and available action context

Rationale:

- removes a direct contradiction between UX flow and Epic 3 MVP story scope

#### Change D2: Add context-retention requirements to review and failure surfaces

Artifact: `ux-design-specification.md`
Sections: `自动化失败后的解释与恢复`, `流程阶段时间线 / 状态账本`, future review queue detail section

OLD:

- UX emphasizes explanation and action, but does not explicitly require context persistence after rejected actions

NEW:

- add UX requirements:
  - failed review submission preserves current item list, entered decision state, and relevant context
  - failed retry submission preserves failure explanation, reason details, and available next actions
  - timeline and exception modules must reflect stable event-driven history, not transient toast-only feedback

Rationale:

- codifies the exact failure class repeated in Epic 2

#### Change D3: Add support diagnostic minimum view contract

Artifact: `ux-design-specification.md`
Section: support diagnostic surface to be added or expanded

OLD:

- support timeline is implied by journey and status-ledger ideas, but not specified as a concrete field contract

NEW:

- add support diagnostic content requirements:
  - preset decision path
  - review required/resolved markers
  - failure phase and reason
  - request/diagnostic ID
  - retry lineage
  - authorization-aware field visibility

Rationale:

- gives Story 3.3 and Story 6.2 a shared UI contract

## 5. Implementation Handoff

### Scope Classification

Moderate

Reason:

- no product pivot
- no rollback
- requires backlog re-sequencing, cross-artifact updates, and contract locking across multiple stories

### Handoff Recipients

- Product Owner
  - confirm Story 3 preparation item placement and Epic 3 sequencing
  - approve acceptance criteria adjustments for Story 3.1, 3.2, 3.3
- Architect
  - define canonical review, retry, event, and support diagnostic contracts
  - update architecture sections and any ADR references
- Developer
  - implement contract-first preparation artifacts
  - ensure front-end context retention regressions are added before or with story delivery
- QA
  - create regression coverage for failed review submit, failed retry submit, and support authorization boundaries

### Success Criteria

- Epic 3 cannot start UI-heavy implementation before the shared contract is documented and accepted.
- Story 3.1 and 3.2 explicitly test context retention after failed actions.
- Story 3.2 retry behavior preserves immutable historical failure context and creates queryable lineage.
- Story 3.3 support diagnostics use a defined minimum field set and testable RBAC rules.
- Story 4.2, 4.3, and 6.2 reference the same shared semantics instead of redefining them locally.

## Checklist Summary

### 1. Understand the Trigger and Context

- [x] 1.1 Triggering story identified: Epic 2 retrospective affecting Epic 3 startup readiness
- [x] 1.2 Core problem defined: cross-story contract gap and sequencing weakness
- [x] 1.3 Evidence gathered: repeated context-loss bug class, architecture/UX contract mismatch

### 2. Epic Impact Assessment

- [x] 2.1 Current epic evaluated: Epic 3 needs preparation gate
- [x] 2.2 Epic-level changes defined: insert preparation story, tighten ACs
- [x] 2.3 Remaining epics reviewed: Epic 4 and Epic 6 are downstream consumers
- [x] 2.4 New epic not required: existing epic remains valid, but needs prep story
- [x] 2.5 Priority/sequencing change needed: yes

### 3. Artifact Conflict and Impact Analysis

- [x] 3.1 PRD conflict checked
- [x] 3.2 Architecture conflict checked
- [x] 3.3 UX conflict checked
- [x] 3.4 Secondary artifact impact checked

### 4. Path Forward Evaluation

- [x] 4.1 Direct adjustment evaluated as viable
- [x] 4.2 Rollback evaluated as not viable
- [x] 4.3 MVP review evaluated as unnecessary primary path
- [x] 4.4 Recommended path selected: Option 1 direct adjustment

### 5. Sprint Change Proposal Components

- [x] 5.1 Issue summary created
- [x] 5.2 Epic and artifact impact documented
- [x] 5.3 Recommended path and rationale documented
- [x] 5.4 MVP impact and high-level action plan documented
- [x] 5.5 Agent handoff plan documented

### 6. Final Review and Handoff

- [x] 6.1 Checklist completion reviewed
- [x] 6.2 Proposal accuracy verified against current PRD, Epics, Architecture, UX, and Epic 2 retrospective
- [x] 6.3 User approval obtained: 季悠然 approved with `yes` on 2026-06-08
- [x] 6.4 Sprint status updated: added `3-0-review-failure-retry-and-diagnostic-contract-setup` as `backlog`
- [x] 6.5 Handoff confirmed: Moderate scope routed to Product Owner, Architect, Developer, and QA

## Approval and Routing

Approval status: Approved

Approved by: 季悠然

Approval date: 2026-06-08

Scope classification: Moderate

Route for implementation:

- Product Owner: confirm Epic 3 sequencing and backlog placement for Story 3.0.
- Architect: lock review, failure, retry, diagnostic, event, and authorization contracts.
- Developer: implement the contract-first preparation work before UI-heavy Epic 3 stories.
- QA: add context-retention and support-authorization regression coverage.

Next implementation step:

- Create and execute Story 3.0: Review, Failure, Retry, and Diagnostic Contract Setup.
