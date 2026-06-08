# Epic 3 Contract Test Matrix

Date: 2026-06-08
Project: Yakimoji
Purpose: 为 Epic 4 提供可审计的内部 contract 验证视图

## Scope

本矩阵聚焦 Epic 3 已建立的内部 contract，并回答两个问题：

1. 哪些关键语义已经被测试覆盖
2. 这些覆盖分别在支撑 Epic 4 的哪部分 API contract 信心

## Matrix

| Contract Area | Key Contract | Test Evidence | Covered Scenarios | Coverage Type | Epic 4 Dependency |
| --- | --- | --- | --- | --- | --- |
| `task status semantics` | 顶层任务状态必须统一、可读、可按阶段投影 | `tests/task-events.test.ts` `legal status transitions append task events and update the task snapshot`; `tests/task-events.test.ts` `illegal status transitions are rejected`; `tests/task-query.test.ts` `task detail returns an oldest-to-newest event ledger and readable status semantics`; `tests/task-query.test.ts` `status mapping helpers keep the unified task status contract readable`; `tests/task-sync.test.ts` `task sync envelope only includes visible creator tasks and uses a small summary payload` | 合法状态流转；非法流转拒绝；旧状态并发失效拒绝；任务详情可读状态语义；同步摘要对 `processing/awaiting_human_review` 的稳定展示 | 成功路径 + 失败路径 + 表达一致性 | `4.1 task create request`; `4.2 status query` |
| `review` | 低置信度 review 必须有统一 payload、明确进入 `awaiting_human_review`、并可读取为稳定 review queue | `tests/task-diagnostics.test.ts` `extractReviewQueue normalizes low-confidence review payloads`; `tests/task-query.test.ts` `task detail builds low-confidence review queue and preserves creator access mode`; `tests/task-query.test.ts` `task detail returns an oldest-to-newest event ledger and readable status semantics` | `task.review_required` payload 归一化；review queue 项目、上下文、pendingCount 投影；任务进入人工复核状态的账本呈现 | 成功路径 + 读模型稳定性 | `4.2 status query`; `4.3 structured failure / non-match response` |
| `failure` | 失败必须保留 machine-readable `reasonCode`、`requestId`、failure stage、human-readable message、trace id | `tests/task-events.test.ts` `failure terminal events preserve machine-readable reason_code and request_id`; `tests/task-diagnostics.test.ts` `extractFailureContext keeps stable failure semantics`; `tests/task-query.test.ts` `support detail exposes diagnostic timeline and hides deliverables` | `task.failed` 事件保留 reason_code/request_id；失败解释投影出 stage/message/diagnosticTraceId/retryable；support 视角能读取失败上下文 | 成功路径 + 诊断稳定性 | `4.2 result query`; `4.3 structured failure response` |
| `retry` | retry 必须创建新 attempt，保留 origin lineage，不覆盖历史失败上下文 | `tests/task-diagnostics.test.ts` `buildRetryAttemptSnapshot increments attempt lineage without mutating origin`; `tests/task-query.test.ts` `support detail exposes diagnostic timeline and hides deliverables`; `tests/workspace-view.test.ts` `support-only workspace detail resolves diagnostic access without creator task list` | attemptNumber 递增；originTaskId 保持稳定；retryOfTaskId 指向当前失败任务；support 详情能读取 lineage 和 retry 后上下文 | 成功路径 + lineage 稳定性 | `4.2 status query`; `4.2 result query`; `4.3 structured failure response` |
| `diagnostics` | support diagnostics 必须能串联 preset resolution、review、failure、retry、attempt lineage，并与 creator 视图隔离 | `tests/task-query.test.ts` `support detail exposes diagnostic timeline and hides deliverables`; `tests/workspace-view.test.ts` `support-only workspace detail resolves diagnostic access without creator task list` | support-only detail 按 taskId 读取；诊断 timeline 包含 attempt/preset/failure/retry 关键上下文；不暴露 deliverables 下载语义；support 与 creator 壳层分离 | 成功路径 + 权限边界 + 视图隔离 | `4.3 structured failure response`; `4.3 non-match response` |
| `auth boundary` | creator / support 访问边界必须明确，禁止越权读取任务或诊断上下文 | `tests/task-query.test.ts` `missing task returns not found with request-scoped payload`; `tests/task-query.test.ts` `existing task owned by someone else still returns forbidden instead of not found`; `tests/workspace-view.test.ts` `support-only workspace detail resolves diagnostic access without creator task list` | 不存在任务返回 404 且携带 `request_id`；他人任务返回 403；support-only 路径不依赖 creator task list；creator/support 模式隔离 | 失败路径 + 权限边界 | `4.1 task create request`; `4.2 status query`; `4.2 result query`; `4.3 structured failure / non-match response` |

## Interpretation

### What Is Already Strong

- 内部状态语义已经有比较明确的成功/失败双向覆盖，不只是 happy path。
- failure contract 已经具备 Epic 4 需要的最关键字段基础：`reasonCode`、`requestId`、`failure stage`、`human-readable message`、`diagnosticTraceId`。
- retry lineage 不是 UI 层临时态，而是有独立测试保护的 attempt 模型。
- support 诊断入口和 creator 视角的权限边界已有明确回归证据。

### What This Matrix Proves for Epic 4

- `Story 4.1` 不需要重新发明任务创建后的状态语义，只需要把现有内部 contract 暴露到 API 认证入口下。
- `Story 4.2` 依赖的状态查询/结果查询前提已经部分具备，尤其是状态、失败解释、retry lineage 的统一语义。
- `Story 4.3` 依赖的结构化失败响应前提已经较强，但还需要把内部 failure / non-match 语义整理成统一外部 envelope。

## Remaining Gaps Before Epic 4

### Gap 1: 缺少面向外部 API 的直接 contract test

当前覆盖主要证明内部语义稳定，尚未直接证明外部 API response shape 稳定。

Impact:

- 需要通过 `epic-4-api-contract-mapping.md` 把内部 contract 映射成外部字段和 envelope。

### Gap 2: `non-match` 对外语义尚未形成专门矩阵项

当前已有预设命中/未命中基础语义和 support timeline 上下文，但 Epic 4 需要的是对外统一异常/分支响应表达。

Impact:

- 需要在 Epic 4 mapping 中显式定义 `non-match` 是 status、result 还是 exception branch。

### Gap 3: API 认证模型尚未有独立验证矩阵

当前 auth boundary 主要覆盖 creator/support 内部边界，不等于 `api_credentials` 与 Web session 的外部 API 认证边界已被证明。

Impact:

- 需要通过 `epic-4-api-auth-test-strategy.md` 补足外部 API 认证和授权验证。

## Readiness Result

结论：`Gate 1` 已经可以认为完成到“证据整理”阶段。

这意味着：

- Epic 3 内部 contract 的测试证据已经可以被系统性引用
- Epic 4 可以在此基础上继续推进 `Gate 2` 和 `Gate 3`
- 但仍不建议直接开始 Epic 4 story 实现，除非 external API mapping 与 auth strategy 同步补齐
