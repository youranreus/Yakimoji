# ADR 003: Support and Ops IA

## Status

Accepted

## Context

支持/运营视图的数据承接已存在，但页面级信息架构未被单独写清，容易在实现时把 support 与 ops 混入创作者工作台，或各自发展出不同导航逻辑。

## Decision

第一阶段采用独立但轻量的 support/ops 页面级结构：

- 创作者主导航保留 `Tasks`、`Presets`
- 内部角色额外看到 `Support`、`Operations`
- `Support` 页面围绕单任务诊断展开：
  - 按任务 ID 查询
  - 查看时间线、未命中原因、失败分类、人工介入记录
- `Operations` 页面围绕聚合可见性展开：
  - 预设命中/未命中
  - 预设复用情况
  - 关键耗时
  - drill-down 到任务列表

## Consequences

- 优点：支持与运营目标分离，权限边界清楚
- 代价：需要维护两套内部页面入口
- 约束：内部视图不能复用创作者页面的弱授权路径，必须走同一 RBAC 与审计链路

## Implementation Notes

- Support 以 task-first 为主，不要求复杂 BI
- Operations 第一版只做 3-5 个核心指标与 drill-down
- 两类页面都必须显示 `request_id` 或等价追踪标识，便于排障
