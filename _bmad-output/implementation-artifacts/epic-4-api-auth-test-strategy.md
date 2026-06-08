# Epic 4 API Auth Test Strategy

Date: 2026-06-08
Project: Yakimoji
Purpose: 为 Epic 4 锁定 `api_credentials` 认证边界、授权边界与合约测试策略

## Goal

在 Epic 4 开工前，明确外部 API 的认证与授权测试范围，避免出现以下问题：

- Web session/cookie 被错误地当成外部 API 认证方式
- `api_credentials` 缺失、无效、过期时行为不一致
- 越权访问返回格式漂移
- 错误路径泄露受保护业务数据
- `request_id` 在认证/授权失败路径上不可追踪

## Boundary Definition

### Security Boundary

- 外部 API 不复用 Web SSO session
- 外部 API 不接受浏览器登录态作为认证依据
- 外部 API 采用独立 `api_credentials`
- 认证与授权失败路径必须使用统一错误 envelope
- 所有失败路径必须可通过 `request_id` 关联日志和审计

### In-Scope Endpoints

- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/result`

### Out-of-Scope for This Gate

- API credential 管理后台本身
- 复杂限流/配额行为
- support-only 内部诊断入口

## Core Test Objectives

1. 证明只有有效 `api_credentials` 能访问外部 API
2. 证明 Web session/cookie 不能替代 API credential
3. 证明无权任务访问不会泄露业务数据
4. 证明所有认证/授权拒绝路径都有稳定 HTTP 语义和错误 envelope
5. 证明 `request_id` 与 `api_credential_id` 等追踪字段在服务端可记录

## Authentication Decision Matrix

| Scenario | Expected HTTP | Expected code | Data leakage allowed | Notes |
| --- | --- | --- | --- | --- |
| missing credential | `401` | `API_CREDENTIAL_MISSING` | no | 未提供凭证 |
| malformed credential | `401` | `API_CREDENTIAL_INVALID` | no | 格式错误或无法解析 |
| unknown credential | `401` | `API_CREDENTIAL_INVALID` | no | 不存在的 credential |
| expired credential | `403` | `API_CREDENTIAL_EXPIRED` | no | 凭证存在但已过期 |
| revoked/disabled credential | `403` | `API_CREDENTIAL_REVOKED` | no | 凭证存在但不可再用 |
| valid credential, forbidden task | `403` | `TASK_FORBIDDEN` | no | 不可返回他人任务详情 |
| valid credential, task not found | `404` | `TASK_NOT_FOUND` | no | 不可伪造成功 envelope |
| browser session only, no credential | `401` | `API_CREDENTIAL_MISSING` | no | 明确不接受 Web 会话替代 |
| browser session + invalid credential | `401` | `API_CREDENTIAL_INVALID` | no | 以 API credential 结果为准 |
| browser session + valid credential | `200/业务结果` | n/a | only authorized data | cookie 不加权、不降权，只忽略 |

## Contract Requirements

### Error Envelope

所有认证/授权失败场景必须返回：

```json
{
  "request_id": "req_123",
  "error": {
    "code": "API_CREDENTIAL_INVALID",
    "message": "API credential is invalid.",
    "details": {}
  }
}
```

### Forbidden / Not Found Rules

- `403` 用于“主体已认证，但无权访问目标资源”
- `404` 用于“目标任务不存在”
- 两者都必须保留 `request_id`
- 两者都不得返回：
  - 任务标题
  - 来源标识
  - 预设命中情况
  - deliverable 信息
  - failure / review / diagnostics 内容

### Success Envelope

成功路径继续使用：

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

## Test Categories

## 1. Authentication Contract Tests

### A1. Missing Credential

- 请求不带 `api_credentials`
- 期望：
  - 返回 `401`
  - `error.code = API_CREDENTIAL_MISSING`
  - 无 `data`
  - 返回 `request_id`

### A2. Malformed Credential

- 凭证头格式错误、空值、结构不合法
- 期望：
  - 返回 `401`
  - `error.code = API_CREDENTIAL_INVALID`
  - 无 `data`
  - 返回 `request_id`

### A3. Unknown Credential

- 提供不存在的 credential
- 期望：
  - 返回 `401`
  - `error.code = API_CREDENTIAL_INVALID`
  - 无 `data`
  - 返回 `request_id`

### A4. Expired Credential

- 提供存在但过期 credential
- 期望：
  - 返回 `403`
  - `error.code = API_CREDENTIAL_EXPIRED`
  - 无 `data`
  - 返回 `request_id`

### A5. Revoked Credential

- 提供被显式停用 credential
- 期望：
  - 返回 `403`
  - `error.code = API_CREDENTIAL_REVOKED`
  - 无 `data`
  - 返回 `request_id`

## 2. Web Session Isolation Tests

### B1. Browser Session Without Credential

- 请求带有效 Web session cookie，但不带 API credential
- 期望：
  - 返回 `401`
  - `error.code = API_CREDENTIAL_MISSING`
  - 不因为已登录而放行

### B2. Browser Session With Invalid Credential

- 请求带有效 Web session cookie，但 API credential 无效
- 期望：
  - 返回 `401`
  - 结果以 API credential 校验失败为准

### B3. Browser Session With Valid Credential

- 请求同时带 cookie 和合法 credential
- 期望：
  - 仅按 credential 主体授权
  - 响应中不出现 Web 用户上下文
  - 审计主体应记录 `api_credential_id`，不是 session user

## 3. Authorization Boundary Tests

### C1. Valid Credential Can Access Owned Task

- 合法 credential 访问其有权任务
- 期望：
  - 返回成功 envelope
  - 仅返回该 credential 有权看到的数据

### C2. Valid Credential Cannot Access Foreign Task

- 合法 credential 访问不属于其授权范围的任务
- 期望：
  - 返回 `403`
  - `error.code = TASK_FORBIDDEN`
  - 不返回目标任务任何业务字段

### C3. Valid Credential Requests Missing Task

- 合法 credential 查询不存在 taskId
- 期望：
  - 返回 `404`
  - `error.code = TASK_NOT_FOUND`
  - 返回 `request_id`

## 4. Endpoint-Specific Contract Tests

### D1. `POST /tasks`

必须覆盖：

- 无 credential
- 无效 credential
- 过期 credential
- 浏览器 cookie 替代认证失败
- 合法 credential 成功创建
- 请求字段无效时返回 `422 TASK_REQUEST_INVALID`

### D2. `GET /tasks/:taskId`

必须覆盖：

- 无 credential
- 无效 credential
- 过期 credential
- foreign task -> `403`
- missing task -> `404`
- 合法 credential 成功查询状态

### D3. `GET /tasks/:taskId/result`

必须覆盖：

- 无 credential
- 无效 credential
- 过期 credential
- foreign task -> `403`
- missing task -> `404`
- 合法 credential 成功查询结果
- failed / non-match 结果仍走成功 envelope 业务语义，不退化为认证错误

## 5. Data Leakage Checks

所有失败路径必须断言以下字段不存在：

- `data`
- `taskId` 之外的任务业务内容
- `sourceIdentifier`
- `sourceTitle`
- `presetResolution`
- `reviewQueue`
- `failure`
- `deliverables`
- `supportDiagnostics`

说明：

- 对 `404 TASK_NOT_FOUND` 和 `403 TASK_FORBIDDEN`，都不要因为调试方便而顺带返回受保护字段

## 6. Observability Requirements

### Request ID

每一个认证/授权测试都必须校验：

- 响应中有 `request_id`
- 服务端可记录对应结构化日志

### Audit / Logging Fields

服务端日志或审计至少应包含：

- `request_id`
- `api_credential_id`（如可解析）
- `task_id`（如适用）
- `event_type` 或等价动作标识
- `auth_result`

### Recommended Assertions

- credential 校验失败时仍记录 `request_id`
- foreign task 拒绝时记录 `task_id`
- cookie 被忽略时不把 session user 误记为 API 主体

## Suggested Test File Layout

- `tests/api/tasks-create-auth.test.ts`
- `tests/api/tasks-status-auth.test.ts`
- `tests/api/tasks-result-auth.test.ts`
- `tests/api/api-credentials-contract.test.ts`

如果先做最小集，可先合并为：

- `tests/api/tasks-auth.test.ts`

## Readiness Gate Criteria

当且仅当以下条件满足，`Gate 3` 才算完成：

- [ ] 已确定 `401/403/404/422` 的认证与授权语义
- [ ] 已确定 cookie/session 不可替代 API credential
- [ ] 已确定失败路径统一错误 envelope
- [ ] 已确定 no-data-leak 断言范围
- [ ] 已确定每个 Epic 4 endpoint 的 auth contract test 场景
- [ ] 已确定 `request_id` 和 `api_credential_id` 的观测要求

## Final Readiness Decision

完成本文件后，Epic 4 的三个前置 gate 已全部具备文档化基础：

- `Gate 1`: Epic 3 contract test matrix
- `Gate 2`: internal-to-external API contract mapping
- `Gate 3`: API auth boundary test strategy

剩余流程只差一次简短的 readiness review。通过后，即可开始 Epic 4 story 开发。
