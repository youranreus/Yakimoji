# ADR 004: Processing Pipeline Provider Adapter Boundary

## Status

Accepted

## Context

PRD 要求完整处理链路覆盖转录、翻译、字幕生成与视频烤制，但架构文档原先没有把 provider adapter 边界写清，容易导致实现时把外部服务调用散落进 worker 或 route handler。

## Decision

第一阶段明确采用 `pipeline stage service + provider adapter` 边界：

- 顶层 pipeline 阶段固定为：
  - source intake
  - transcription
  - translation
  - subtitle generation
  - video burn-in
  - delivery packaging
- 每个外部能力通过对应 provider adapter 暴露统一接口
- worker 只编排阶段推进、错误处理和状态落盘，不直接内联第三方服务细节
- provider adapter 返回标准化结果与标准化错误码

## Consequences

- 优点：后续替换供应商或增加 mock provider 更容易
- 代价：第一阶段需要多一层抽象
- 约束：任务失败原因码必须先在 adapter 层标准化，再映射到顶层任务状态与 API 响应

## Implementation Notes

- 每个阶段 service 负责输入校验、调用 adapter、产出阶段结果
- adapter 层禁止直接更新顶层任务状态
- review-required 场景应由阶段 service 产出标准化 review item，再由 worker 推进任务到 `awaiting_human_review`
