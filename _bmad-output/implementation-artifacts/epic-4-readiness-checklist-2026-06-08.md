# Epic 4 Readiness Checklist

Date: 2026-06-08
Project: Yakimoji
Source: Epic 3 retrospective follow-up

## Purpose

这份清单用于把 Epic 3 retrospective 中确认的 Epic 4 前置 gate 落成可执行项。

Epic 4 在以下三项完成前，不进入正式 story 开发：

- Epic 3 contract test matrix
- internal-to-external API contract mapping
- `api_credentials` 认证边界测试策略

## Gate 1: Epic 3 Contract Test Matrix

### Goal

证明 Epic 3 的内部 contract 已被系统性验证，并明确这些验证如何支撑 Epic 4 的 API contract 信心。

### Checklist

- [ ] 建立统一矩阵分组：
  - `task status semantics`
  - `review`
  - `failure`
  - `retry`
  - `diagnostics`
  - `auth boundary`
- [ ] 为每个分组列出对应测试文件
- [ ] 为每个分组列出覆盖的关键场景
- [ ] 标记哪些是成功路径验证
- [ ] 标记哪些是失败路径/上下文保留验证
- [ ] 标记哪些是权限边界验证
- [ ] 为每个分组增加一列 `Epic 4 dependency`
- [ ] 明确该分组支撑的是：
  - `4.1 task create request`
  - `4.2 status query`
  - `4.2 result query`
  - `4.3 structured failure response`
  - `4.3 non-match response`

### Exit Criteria

- [ ] 能快速回答“Epic 4 依赖的内部 contract 分别由哪些测试支撑”
- [ ] 能快速识别未覆盖的高风险组合
- [ ] 矩阵可被 QA、Developer、Architect 共同审阅

## Gate 2: Internal-to-External API Contract Mapping

### Goal

把 Epic 3 的内部状态/事件/失败语义整理成 Epic 4 可直接消费的外部 API contract 映射，避免 story 实现时临时翻译。

### Checklist

- [ ] 列出内部顶层任务状态全集
- [ ] 标记哪些状态可直接外露，哪些需要转换后外露
- [ ] 列出 review 相关内部语义与外部可见语义的映射
- [ ] 列出 failure phase、reason code、human-readable message 的映射
- [ ] 列出 retry lineage 内部字段与外部结果字段的映射
- [ ] 列出 preset non-match 相关内部语义与外部响应语义的映射
- [ ] 明确哪些字段属于 task status 接口
- [ ] 明确哪些字段属于 task result 接口
- [ ] 明确哪些字段仅属于 support diagnostics，不应外露给外部 API
- [ ] 明确统一 success envelope
- [ ] 明确统一 error envelope
- [ ] 明确 request_id 在创建、状态查询、结果查询、异常响应中的位置

### Exit Criteria

- [ ] Story 4.1~4.3 在开工前已有可引用映射文档
- [ ] 不再需要在 story 过程中临时决定字段命名与 envelope 结构
- [ ] Architect 与 Developer 对外露边界达成一致

## Gate 3: API Credentials Auth Boundary Test Strategy

### Goal

在 Epic 4 开始前，先锁定 API 认证模型边界，避免 Web session 与外部 API credential 混用。

### Checklist

- [ ] 明确 `api_credentials` 的认证入口
- [ ] 明确 Web session/cookie 不能访问外部 API 的规则
- [ ] 列出以下认证测试场景：
  - 无凭证
  - 无效凭证
  - 过期凭证
  - 凭证格式错误
  - 使用 Web cookie/session 访问 API
  - 凭证有效但访问无权任务
- [ ] 为每种场景明确预期响应：
  - `401`
  - `403`
  - 不返回受保护业务数据
- [ ] 明确 task create 接口的主体追踪字段
- [ ] 明确 task status/result query 的授权范围
- [ ] 明确 request_id 与 credential context 的记录要求
- [ ] 明确哪些测试属于 contract test
- [ ] 明确哪些测试属于 authorization regression

### Exit Criteria

- [ ] API 认证边界已可测试表达
- [ ] Web 认证与 API 认证隔离规则已明确
- [ ] Epic 4 开发前不存在“认证模型待定”问题

## Recommended Execution Order

1. 先完成 Gate 1，确认已有内部 contract 验证基础
2. 再完成 Gate 2，把内部语义映射成外部 API contract
3. 最后完成 Gate 3，锁定外部 API 认证与授权测试策略

## Readiness Decision

只有当以下条件同时满足时，Epic 4 才可进入正式 story 开发：

- [x] Gate 1 完成
- [x] Gate 2 完成
- [x] Gate 3 完成
- [x] 相关产物已被团队审阅

Review record:

- `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/epic-4-readiness-review-2026-06-08.md`

## Suggested Output Files

- `epic-3-contract-test-matrix.md`
- `epic-4-api-contract-mapping.md`
- `epic-4-api-auth-test-strategy.md`
