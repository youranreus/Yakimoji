# ADR 002: OpenAPI Ownership Model

## Status

Accepted

## Context

Yakimoji 需要同时维护内部实现一致性和对外 API 合约稳定性。原架构文档指出 internal/public OpenAPI ownership 未明确，容易导致“代码先写、文档后补”或“文档与实现漂移”。

## Decision

第一阶段采用 `code-first implementation + checked-in public OpenAPI contract` 模式：

- 路由处理、校验 schema、响应 envelope 先在代码中定义
- `docs/api/public-openapi.yaml` 作为对外契约发布物，纳入版本控制
- 通过生成或校验脚本从代码与 schema 导出/比对 public contract
- CI 必须包含 OpenAPI contract validation
- internal API 可不单独维护完整外部 spec，但其共享 schema 与 envelope 规则必须与 public contract 一致

## Consequences

- 优点：减少手写 spec 与实现漂移
- 代价：需要明确生成/校验脚本与 review 责任
- 约束：任何 public API 的破坏性字段或状态语义变更，都必须先更新 contract 再合并实现

## Implementation Notes

- 统一成功响应为 `{ data, meta }`
- 统一错误响应包含 `request_id` 与 `error.code`
- 对外状态枚举只能来自单点共享契约定义
