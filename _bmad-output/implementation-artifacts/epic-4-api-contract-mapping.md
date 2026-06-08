# Epic 4 API Contract Mapping

Date: 2026-06-08
Project: Yakimoji
Purpose: 将 Epic 3 已稳定的内部 contract 映射为 Epic 4 可直接实现的外部 API contract

## Scope

本文件回答三个问题：

1. 哪些内部任务/失败/retry/non-match 语义需要外露给外部 API
2. 这些语义应该以什么字段和 envelope 形式外露
3. 哪些内部 support / diagnostic 语义不应直接暴露给外部 API

## Source Contracts

本映射基于以下既有约束：

- 统一成功 envelope:
  ```json
  {
    "data": {},
    "meta": {}
  }
  ```
- 统一错误 envelope:
  ```json
  {
    "request_id": "req_123",
    "error": {
      "code": "TASK_NOT_FOUND",
      "message": "Task not found.",
      "details": {}
    }
  }
  ```
- 顶层任务状态统一使用 `snake_case`
- API JSON 字段统一使用 `camelCase`
- `request_id` 必须全链路可见
- 外部 API 使用独立 `api_credentials`，不复用 Web session

## Epic 4 Resource Surface

### Primary Endpoints

- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/result`

### Optional Internal/Deferred Endpoints

这些不属于 Epic 4 当前最小范围：

- `GET /tasks/:taskId/events`
- `GET /tasks/:taskId/review-items`
- support-only diagnostics endpoint

原因：

- Epic 4 的目标是让外部系统创建任务、查状态、查结果、拿结构化异常
- review 明细和 support diagnostics 属于内部视角，不宜在本 epic 一开始直接外露

## Contract 1: Task Create Response

### Intent

对应 Story 4.1，创建成功后返回足以继续查询该任务的最小信息。

### Internal Source

- `tasks.id`
- `tasks.status`
- `sourceSnapshot`
- `presetSnapshot.status`
- `request_id`
- API 调用主体上下文

### External Response Shape

```json
{
  "data": {
    "taskId": "task_123",
    "status": "created",
    "sourceType": "youtube_link",
    "createdBy": {
      "type": "apiCredential",
      "credentialId": "cred_123"
    },
    "links": {
      "task": "/tasks/task_123",
      "result": "/tasks/task_123/result"
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Mapping Rules

- 内部 `task.id` -> 外部 `data.taskId`
- 内部顶层 `task.status` -> 外部 `data.status`
- 内部 intake method / source type -> 外部 `data.sourceType`
- API credential 主体 -> 外部 `data.createdBy`
- `request_id` -> 外部 `meta.requestId`

### Notes

- 创建成功响应不返回 support diagnostics
- 创建成功响应不提前暴露 review item 明细
- 创建成功响应只返回“后续可查询入口”，不返回完整 task detail 读模型

## Contract 2: Task Status Query

### Intent

对应 Story 4.2，允许外部系统稳定查询任务当前统一状态。

### External Response Shape

```json
{
  "data": {
    "taskId": "task_123",
    "status": "processing",
    "statusLabel": "正在处理",
    "resultState": "not_ready",
    "reviewState": "none",
    "attempt": {
      "attemptNumber": 1,
      "originTaskId": "task_123",
      "retryOfTaskId": null
    },
    "presetResolution": {
      "status": "matched"
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Mapping Rules

#### Top-level status

| Internal status | External `data.status` | Meaning |
| --- | --- | --- |
| `created` | `created` | 任务已创建 |
| `resolving_source` | `resolving_source` | 正在识别来源 |
| `matching_preset` | `matching_preset` | 正在匹配预设 |
| `awaiting_preset_decision` | `awaiting_preset_decision` | 等待预设决策 |
| `queued` | `queued` | 已进入队列 |
| `processing` | `processing` | 正在处理 |
| `awaiting_human_review` | `awaiting_human_review` | 等待人工复核 |
| `failed` | `failed` | 处理失败 |
| `completed` | `completed` | 处理完成 |
| `cancelled` | `cancelled` | 已取消 |

#### Result state

| Internal signal | External `data.resultState` |
| --- | --- |
| not completed / no deliverables | `not_ready` |
| completed + deliverables available | `ready` |
| completed + deliverables expired | `expired` |
| failed | `failed` |

#### Review state

| Internal signal | External `data.reviewState` |
| --- | --- |
| no review queue | `none` |
| `awaiting_human_review` with pending items | `required` |
| review resolved and task resumed | `resolved` |

### Notes

- 外部 API 可以返回 `statusLabel` 作为人工排障辅助，但集成方必须以 `status` 为真源
- `attempt` 可外露最小 lineage 字段，因为它直接影响 retry 后的状态理解
- `presetResolution.status` 可外露为简化字段，不外露内部 summary 文案

## Contract 3: Task Result Query

### Intent

对应 Story 4.2，允许外部系统在任务完成或终态后获取结果信息。

### External Response Shape

```json
{
  "data": {
    "taskId": "task_123",
    "status": "completed",
    "result": {
      "state": "ready",
      "deliverables": [
        {
          "kind": "video",
          "fileName": "final.mp4",
          "mimeType": "video/mp4",
          "downloadUrl": "https://...",
          "expiresAt": "2026-06-15T10:30:00Z"
        }
      ]
    },
    "attempt": {
      "attemptNumber": 1,
      "originTaskId": "task_123",
      "retryOfTaskId": null
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Mapping Rules

- 内部 `detail.resultStatus` -> 外部 `data.result.state`
- 内部 `deliverables` -> 外部 `data.result.deliverables`
- deliverable 内部访问动作 -> 外部受控下载 endpoint
- attempt snapshot -> 外部 `data.attempt`

### Deliverable Exposure Rules

- 可暴露：
  - `kind`
  - `fileName`
  - `mimeType`
  - `expiresAt`
  - `download`
- 不直接暴露：
  - support-only 诊断字段
  - 内部存储键
  - 内部下载授权实现细节

### Deliverable Access Decision

Epic 4 不直接返回长期可复用或实现细节不透明的裸 `downloadUrl`。

统一返回受控下载描述：

```json
{
  "kind": "video",
  "fileName": "final.mp4",
  "mimeType": "video/mp4",
  "expiresAt": "2026-06-15T10:30:00Z",
  "download": {
    "method": "GET",
    "href": "/tasks/task_123/result/deliverables/video/download"
  }
}
```

理由：

- 与受控下载/短时效访问策略保持一致
- 不把对象存储签名细节固化进 Epic 4 API 主 contract
- 允许后续在 download endpoint 内部选择重定向、短时效 URL 或其它受控访问实现

## Contract 4: Structured Failure Response

### Intent

对应 Story 4.3，将 Epic 3 的失败 contract 映射为外部统一结构。

### Internal Source

- `task.failed` event
- `reasonCode`
- `failureStage`
- `failureMessage`
- `diagnosticTraceId`
- `retryable`
- `attempt`

### External Response Shape

```json
{
  "data": {
    "taskId": "task_123",
    "status": "failed",
    "failure": {
      "reasonCode": "worker_timeout",
      "stage": "subtitle_generation",
      "message": "Processing worker timed out.",
      "diagnosticTraceId": "trace_123",
      "retryable": true,
      "recommendedAction": "retry_with_new_attempt"
    },
    "attempt": {
      "attemptNumber": 2,
      "originTaskId": "task_123",
      "retryOfTaskId": "task_122"
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Mapping Rules

| Internal field | External field | Notes |
| --- | --- | --- |
| `failureContext.reasonCode` | `data.failure.reasonCode` | 机器可读真源 |
| `failureContext.stage` | `data.failure.stage` | 建议转换为 API 规范枚举或稳定英文值 |
| `failureContext.message` | `data.failure.message` | 人工可读 |
| `failureContext.diagnosticTraceId` | `data.failure.diagnosticTraceId` | 用于排障 |
| `failureContext.retryable` | `data.failure.retryable` | 是否允许发起新 attempt |
| `failureContext.recommendedAction` | `data.failure.recommendedAction` | 对外建议动作 |

### Stage Normalization Rule

内部失败阶段当前可能是中文可读值，外部 API 不应直接依赖展示文案。

最终外部枚举固定为：

- `source_resolution`
- `preset_matching`
- `queueing`
- `processing`
- `human_review`
- `subtitle_generation`
- `deliverable_packaging`
- `result_delivery`

映射原则：

- 内部中文阶段文案继续保留给 Web UI
- 外部 API 仅返回上面的稳定英文枚举
- 未识别阶段统一回退到 `processing`

## Contract 5: Structured Non-match Response

### Intent

对应 Story 4.3，将“未命中预设”从内部流程分支转换成外部可程序消费语义。

### Internal Source

- `presetSnapshot.status`
- task status 可能停留在 `awaiting_preset_decision`
- 现有内部分支：
  - `matched`
  - `manual_reuse`
  - `manual_create`
  - `continue_without_preset`
  - `unresolved`
  - `none`

### External Response Positioning

未命中预设不应被建模为 transport-level error。

建议：

- 作为 `200` 成功 envelope 内的业务分支状态返回
- 通过 `data.status = "awaiting_preset_decision"` + `data.presetResolution.status = "unresolved"` 表达

### External Response Shape

```json
{
  "data": {
    "taskId": "task_123",
    "status": "awaiting_preset_decision",
    "presetResolution": {
      "status": "unresolved",
      "nextAction": "manual_resolution_required",
      "message": "No matching preset was found for this source."
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Mapping Rules

| Internal preset status | External `presetResolution.status` | Meaning |
| --- | --- | --- |
| `matched` | `matched` | 已自动命中 |
| `manual_reuse` | `manual_reuse` | 人工复用已有预设 |
| `manual_create` | `manual_create` | 人工创建预设后继续 |
| `continue_without_preset` | `continue_without_preset` | 无预设继续 |
| `unresolved` | `unresolved` | 未命中且等待决策 |
| `none` | `none` | 无预设上下文 |

### Why It Is Not an Error Envelope

- 它是业务分支，不是认证/授权/服务器错误
- 外部系统需要据此决定后续动作，而不是把它视为 HTTP 失败

## Contract 6: Error Envelope Mapping

### Use Cases

以下场景使用统一错误 envelope，而不是成功 envelope 中的业务状态：

- 无效或缺失 API credential
- 无权访问该任务
- 请求字段校验失败
- 请求资源不存在
- 服务器内部错误

### Mapping

| Scenario | HTTP | Error code | Notes |
| --- | --- | --- | --- |
| missing credential | `401` | `API_CREDENTIAL_MISSING` | 不返回业务数据 |
| invalid credential | `401` | `API_CREDENTIAL_INVALID` | 与 auth strategy 保持一致 |
| expired credential | `403` | `API_CREDENTIAL_EXPIRED` | 明确与无凭证区分 |
| forbidden task access | `403` | `TASK_FORBIDDEN` | 保留 `request_id` |
| task not found | `404` | `TASK_NOT_FOUND` | 保留 `request_id` |
| validation failed | `422` | `TASK_REQUEST_INVALID` | `details` 提供字段级信息 |
| unexpected server error | `500` | `INTERNAL_ERROR` | 不泄露内部敏感细节 |

## Fields That Must Not Be Exposed Directly

以下字段允许留在内部 contract，但不应直接成为外部 API 标准字段：

- `supportDiagnostics.entries`
- `supportCategory`
- creator/support 视图专用说明文案
- 内部事件账本原始 payload
- 内部 deliverable 存储键
- 内部 workspace shell / panel 概念

## Recommended Story-by-Story Usage

### Story 4.1

- 使用 `Task Create Response`
- 使用 `Error Envelope Mapping`
- 暂不实现完整结果语义

### Story 4.2

- 使用 `Task Status Query`
- 使用 `Task Result Query`
- 保持 `attempt` 字段最小但稳定

### Story 4.3

- 使用 `Structured Failure Response`
- 使用 `Structured Non-match Response`
- 统一异常/分支 contract，不新增第二套 envelope

## Remaining Narrow Decision

- `non-match` 是否在 `/tasks/:taskId/result` 同时暴露，还是仅在 `/tasks/:taskId` 状态查询暴露

当前建议：

- `non-match` 必须在 `/tasks/:taskId` 暴露
- `/tasks/:taskId/result` 可在 `status != completed` 时返回同一业务分支语义，但 4.1/4.2/4.3 的最小实现不强制要求先支持该重复暴露

## Readiness Result

结论：`Gate 2` 已具备作为 Epic 4 contract 草案的基础。

这意味着：

- Story 4.1~4.3 不必在开发过程中临时决定主要外部字段
- Epic 4 还剩最后一个关键前置项：`api_credentials` auth boundary test strategy
