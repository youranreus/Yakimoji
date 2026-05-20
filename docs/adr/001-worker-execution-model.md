# ADR 001: Worker Execution Model

## Status

Accepted

## Context

Yakimoji 第一阶段需要后台异步处理链路，但架构文档原先没有把最小执行机制写死，容易导致实现阶段在“DB polling”“轻量 job consumer”“引入额外队列”等方案间分叉。

## Decision

第一阶段采用 `PostgreSQL-backed job table + single background worker polling` 的最小执行模型：

- `tasks` 保存顶层任务状态
- `task_events` 保存状态变化与关键事件
- `task_jobs` 作为后台执行队列表，按任务阶段拆分 job
- 单独的 `background-worker` 进程以固定 polling interval 拉取可执行 job
- worker 使用数据库锁或等价 claim 机制避免重复消费
- 不在第一阶段引入 Redis、外部消息队列或事件总线作为硬依赖

## Consequences

- 优点：实现简单、部署约束低、与 MVP 范围匹配
- 代价：吞吐和横向扩展能力有限，但对第一阶段可接受
- 约束：状态推进必须以数据库为真源，前端与 API 不得绕过 job/event 模型自造状态

## Implementation Notes

- 每个 job 至少包含 `task_id`、`job_type`、`attempt`、`status`、`run_after`、`claimed_at`、`finished_at`
- worker 失败必须写入 machine-readable 原因代码，并推动顶层任务状态更新
- SSE 与轮询读取的都应是持久化后的任务状态与事件，而不是 worker 内存态
