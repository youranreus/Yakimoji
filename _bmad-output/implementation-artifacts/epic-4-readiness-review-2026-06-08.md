# Epic 4 Readiness Review

Date: 2026-06-08
Project: Yakimoji
Reviewer: Amelia (Developer)

## Review Scope

本次 review 检查以下三项前置 gate 是否足以放行 Epic 4 story 开发：

- `epic-3-contract-test-matrix.md`
- `epic-4-api-contract-mapping.md`
- `epic-4-api-auth-test-strategy.md`

## Initial Findings

首次 review 发现三项阻塞：

1. `invalid credential` 的 HTTP 语义在 mapping 与 auth strategy 之间不一致
2. result query 的 deliverable access contract 仍保留“`downloadUrl` 或受控访问描述”的模糊写法
3. `failure.stage` 只有建议值，没有最终固定枚举

## Resolutions Applied

### 1. Invalid Credential HTTP Semantics

已统一为：

- `401`
- `API_CREDENTIAL_INVALID`

结论：

- mapping 与 auth strategy 已收口为单一真源

### 2. Deliverable Access Contract

已统一为：

- Epic 4 result query 不直接返回长期裸 `downloadUrl`
- 返回受控下载 endpoint 描述：
  - `download.method`
  - `download.href`

结论：

- Story 4.2 不需要在实现时临时决定下载访问 contract

### 3. Failure Stage External Enum

已固定为：

- `source_resolution`
- `preset_matching`
- `queueing`
- `processing`
- `human_review`
- `subtitle_generation`
- `deliverable_packaging`
- `result_delivery`

结论：

- Story 4.3 不需要在实现时临时扩写失败阶段枚举

## Final Review Decision

**Result: Pass with one noted non-blocking follow-up**

放行理由：

- Gate 1 已提供 Epic 3 内部 contract 的系统化测试证据
- Gate 2 已把外部 API 的主要字段、envelope、failure、non-match、deliverable access 收口
- Gate 3 已把 `api_credentials`、cookie/session 隔离、401/403/404/422 语义和 no-data-leak 边界收口

## Non-Blocking Follow-up

- 后续可再决定 `non-match` 是否也在 `/tasks/:taskId/result` 重复暴露

该问题不会阻塞 Epic 4 开工，因为：

- `non-match` 已明确必须在 `/tasks/:taskId` 状态查询中暴露
- Story 4.3 的最小 contract 已足够实现

## Approved Start Condition

Epic 4 现在可以开始 story 开发。

建议顺序：

1. Story 4.1: API Credential Validation and Task Create Request
2. Story 4.2: API Task Status and Result Query Contract
3. Story 4.3: Structured Failure and Non-match API Responses
