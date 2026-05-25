# Story 1.4: Task Lifecycle State Model and Persistent Event Ledger

Status: done

## Story

As a 创作者,
I want 我的任务在提交后进入统一且可追踪的生命周期,
so that 后续列表、详情、支持与 API 都能基于同一真源理解任务进展。

## Acceptance Criteria

1. **Given** 创作者已成功提交一个任务  
   **When** 系统开始推进后台处理链路  
   **Then** 任务必须按照统一的顶层状态模型进入可追踪的生命周期  
   **And** Web 工作台展示的状态命名必须与系统对外任务状态语义保持一致
2. **Given** 任务在后台有多次状态流转  
   **When** 后台真实状态持续推进  
   **Then** 系统必须把关键状态变化持久化为任务事件或等价账本记录  
   **And** 这些记录应可作为后续支持排障、运营审计与状态回放的基础，而不是只存在前端临时状态中
3. **Given** 某个任务进入失败终态或处理中断  
   **When** 系统写入该任务的终态  
   **Then** 系统必须同时保留可机器读取的原因代码与可追踪的 `request_id` 或等价诊断标识  
   **And** 失败终态必须能被后续 Web、API 与支持视图统一读取

## Tasks / Subtasks

- [x] 建立 `task_events` 持久化模型与迁移 (AC: 2, 3)
  - [x] 新增 `database/schema/task-events.ts`，使用 `snake_case` 复数表名 `task_events`
  - [x] 至少包含 `task_id`、`event_type`、`from_status`、`to_status`、`reason_code`、`request_id`、`payload`、`created_at`
  - [x] 通过 `database/schema/index.ts` 汇总导出，并生成对应 Drizzle migration
  - [x] 为 `task_id`、`event_type`、`request_id`、`created_at` 建立可查询索引

- [x] 固化任务生命周期的单点状态契约 (AC: 1, 2, 3)
  - [x] 继续以 `app/features/tasks/server/task-status.server.ts` 作为唯一顶层状态枚举来源
  - [x] 不在 route、component、SSE handler 或 API 层引入第二套状态字符串
  - [x] 保持 `created` 为初始状态，并允许后续状态通过统一 helper 过渡
  - [x] 将细粒度过程信息放入 `task_events`，不要膨胀顶层状态枚举

- [x] 增加任务事件写入与状态转换服务边界 (AC: 1, 2, 3)
  - [x] 新增 `app/features/tasks/server/task-events.server.ts`，封装事件追加、状态流转校验与失败终态记录
  - [x] 在任务创建与后续状态变更时写入事件，不要只更新 `tasks.status`
  - [x] 失败与中断事件必须携带机器可读原因码和 `request_id`
  - [x] 允许将人工介入、恢复和完成作为显式事件类型，为后续 review / SSE 留接口

- [x] 把现有任务写入路径接入事件账本 (AC: 2, 3)
  - [x] 复用 `app/features/tasks/server/task-intake.server.ts` 的创建闭环，在确认创建时补写初始事件
  - [x] 保证 `tasks` 主表和 `task_events` 账本之间的写入一致性
  - [x] 不把事件模型和处理编排一起做完，本 story 只建立真源起点

- [x] 补齐可查询的生命周期读取帮助器 (AC: 1, 2, 3)
  - [x] 提供从 `tasks + task_events` 组合出当前生命周期快照的 server helper
  - [x] 保持 Web / API / support 读取同一状态语义
  - [x] 不在本 story 实现 SSE 推送或完整列表页，只准备给后续故事消费的真源数据

- [x] 测试与验证 (AC: 1, 2, 3)
  - [x] 单测合法与非法状态流转、事件追加、失败终态原因码和 `request_id`
  - [x] 集成测试任务创建后会落初始事件，而不是只有 `tasks.status`
  - [x] 保留并继续通过 Story 1.3 的任务导入与 auth/session 相关测试
  - [x] 完成后运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`

## Dev Notes

### Story Intent

- 这是 Epic 1 的生命周期真源故事，不是任务列表、详情页、SSE 或 review 的实现。
- 本 story 的目标是把“任务状态”从单表字段提升为可追踪、可回放、可审计的领域模型。
- 只做统一状态契约和持久事件账本；不要提前实现 Story 1.5、1.6、3.x 或 4.x 的展示/API 终端。

### Epic Context

- Epic 1 的主线是安全登录、导入任务、理解状态并拿到首个可交付结果。
- Story 1.3 已经建立了真实 `tasks` 写入闭环；Story 1.4 需要在此基础上补上统一生命周期与事件账本。
- 后续 Story 1.5 / 1.6 会消费这里沉淀的状态真源来做列表、详情和状态同步。

### Previous Story Intelligence

- Story 1.3 已经证明：任务创建必须落真实数据库，不允许把草稿状态只留在客户端。
- 现有任务初始状态来自 `app/features/tasks/server/task-status.server.ts`，当前基线是 `created`。
- 任务导入链路已经使用 server-only helper、`request_id` 和受保护 workspace 入口，Story 1.4 应继续沿用同样模式。

### Git Intelligence Summary

- 最近提交 `c261726` 和 `b596b9a` 说明当前实现风格是 route-first + server helper + 结构化测试。
- 继续把领域逻辑放在 `app/features/tasks/server/*`，不要把状态机塞进 route JSX 或 shared 目录。
- 继续让数据库 schema、测试和故事文档保持同一套领域命名。

### Architecture Compliance

- 数据层必须遵循 `PostgreSQL + Drizzle ORM + Drizzle migrations`。
- `task_events` 是架构明确要求的核心模型之一，和 `tasks`、`deliverables`、`audit_logs` 一起承接状态与审计能力。
- 顶层任务状态必须来自单点共享枚举：`created`、`resolving_source`、`matching_preset`、`awaiting_preset_decision`、`queued`、`processing`、`awaiting_human_review`、`failed`、`completed`、`cancelled`。
- 细粒度过程放到 `task_events`，不要把内部实现细节直接暴露成新的公开状态。
- 失败、中断和人工介入必须保留机器可读原因码与 `request_id`。

### Current Codebase State and Files to Update

- `database/schema/tasks.ts`
  - 当前状态：已有 `tasks` 主表和 `taskIntakeDrafts`，但没有 `task_events`
  - 本 story 要改：补齐事件账本相关 schema 与索引
  - 必须保留：现有 `tasks` 字段、`processingBaselineSnapshot`、`uploadStorageKey`
- `database/schema/index.ts`
  - 当前状态：已汇总 `auth`、`health`、`tasks`
  - 本 story 要改：新增 `task_events` 导出
  - 必须保留：现有 schema 汇总顺序与迁移历史
- `app/features/tasks/server/task-status.server.ts`
  - 当前状态：定义顶层任务状态枚举和初始状态
  - 本 story 要改：继续作为唯一状态真源，不要复制枚举
  - 必须保留：现有状态字符串兼容性
- `app/features/tasks/server/task-intake.server.ts`
  - 当前状态：任务确认时只写 `tasks`
  - 本 story 要改：在创建时补写初始事件，并为后续状态变更预留 helper
  - 必须保留：Story 1.3 的预览/确认闭环与 `request_id`
- `app/features/tasks/server/task-events.server.ts`
  - 当前状态：不存在
  - 本 story 要改：新增事件写入与状态过渡 helper
  - 必须保留：领域代码留在 `features/tasks/server`
- `tests/task-events.test.ts`
  - 当前状态：不存在
  - 本 story 要改：新增状态流转与事件账本测试

### Data Modeling Guidance

- 推荐最小字段：
  - `id`
  - `task_id`
  - `event_type`
  - `from_status`
  - `to_status`
  - `reason_code`
  - `request_id`
  - `payload` JSONB
  - `created_at`
  - `actor_user_id` 可选，用于人工介入或支持操作
- 数据库字段使用 `snake_case`，应用层返回保持现有 camelCase 风格。
- `payload` 只存可审计、可回放的最小上下文，不要把大对象或二进制塞进去。

### Implementation Guardrails

- 不要只更新 `tasks.status` 而不落事件账本。
- 不要在不同模块各自发明状态名、事件名或失败码。
- 不要把 SSE、列表页、详情页、review 流和下载链路一起做进来。
- 不要把事件字段设计成未来扩展的无限大 JSON 黑洞。
- 不要改动 Story 1.3 已验证的导入闭环行为。

### Testing Requirements

- 必须覆盖：
  - 合法状态过渡会写入 `task_events`
  - 非法状态过渡会被拒绝
  - 失败终态保留原因码和 `request_id`
  - 任务创建会生成初始事件
  - 读取 helper 能从 `tasks + task_events` 得到一致的当前状态
- 保持 Story 1.3 的任务导入、session 和 auth 测试继续通过。

### References

- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-1.4]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Data-Architecture]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Task-Status-Model]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Decision-Impact-Analysis]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#流程阶段时间线--状态账本]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/database/schema/tasks.ts]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-status.server.ts]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/package.json]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-3-manual-task-intake-with-source-recognition-preview.md]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Story created from Epic 1 / Story 1.4 context
- Existing task intake implementation and schema reviewed before authoring
- Added task_events schema, lifecycle helper, transactional task creation event write, and snapshot reader
- Verified with `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, and `pnpm build`

### Completion Notes List

- Implemented `task_events` ledger with indexes, foreign keys, and migration output
- Added lifecycle status helpers, event append/transition APIs, and task snapshot reader
- Wired task creation to write the initial event in the same transaction as task persistence
- Verified Story 1.3 intake/auth/session tests still pass

## Change Log

- 2026-05-25: Implemented the task lifecycle event ledger, shared status contract, transactional creation event write, and lifecycle snapshot helper.

### File List

- /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-4-task-lifecycle-state-model-and-persistent-event-ledger.md
- /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-events.server.ts
- /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-intake.server.ts
- /Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-status.server.ts
- /Users/reuszeng/Code/Projects/Yakimoji/database/schema/index.ts
- /Users/reuszeng/Code/Projects/Yakimoji/database/schema/task-events.ts
- /Users/reuszeng/Code/Projects/Yakimoji/drizzle/0005_glamorous_thena.sql
- /Users/reuszeng/Code/Projects/Yakimoji/drizzle/meta/_journal.json
- /Users/reuszeng/Code/Projects/Yakimoji/drizzle/meta/0005_snapshot.json
- /Users/reuszeng/Code/Projects/Yakimoji/tests/task-events.test.ts
- /Users/reuszeng/Code/Projects/Yakimoji/tests/task-intake.test.ts
- /Users/reuszeng/Code/Projects/Yakimoji/tsconfig.vite.tsbuildinfo
