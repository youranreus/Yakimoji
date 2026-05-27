# Story 1.7: Completed Deliverables and Secure Result Access

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 在任务完成后下载成品视频和字幕文件,
so that 我能直接拿到可交付结果而不需要额外人工整理。

## Acceptance Criteria

1. **Given** 某个任务已进入完成终态  
   **When** 创作者打开任务详情页  
   **Then** 页面必须明确展示该任务的最终交付结果状态  
   **And** 至少列出可获取的成品视频与关联字幕文件
2. **Given** 任务已生成交付物  
   **When** 创作者查看交付结果区域  
   **Then** 页面必须为每个交付物展示可识别的文件类型、可用状态和下载入口  
   **And** 交付结果表达应强调结果可交付，而不只是任务已完成
3. **Given** 创作者拥有该任务的访问权限  
   **When** 创作者请求下载成品视频或字幕文件  
   **Then** 系统必须先执行授权检查  
   **And** 仅通过受控下载或短时效访问方式提供文件访问，而不能暴露长期公共 URL
4. **Given** 创作者无权访问某个任务或其交付物  
   **When** 创作者尝试访问对应下载入口  
   **Then** 系统必须返回 403 或 404  
   **And** 不得泄露可直接访问对象存储文件的长期地址
5. **Given** 交付物已准备完成  
   **When** 创作者在交付物保留期内访问结果  
   **Then** 交付物必须保持可下载  
   **And** 下载能力需满足已定义的可用性目标和时效控制要求
6. **Given** 下载请求成功或失败  
   **When** 系统处理该请求  
   **Then** 系统必须记录与下载动作相关的审计或访问日志  
   **And** 该记录至少能够关联任务、请求主体和下载时间
7. **Given** 某个任务尚未完成或尚无可用交付物  
   **When** 创作者查看任务详情  
   **Then** 页面必须清楚区分处理中、已完成但部分结果不可用或尚未生成交付物等状态  
   **And** 不得展示误导性的可下载结果入口

## Tasks / Subtasks

- [x] 建立交付物领域数据模型与持久化契约 (AC: 1, 2, 5, 6, 7)
  - [x] 在 `database/schema/` 中新增 `deliverables` 表定义，并通过 Drizzle migration 落地 `task_id`、`kind`、`storage_key`、`mime_type`、`file_size_bytes`、`status`、`available_at`、`expires_at`、`metadata` 等最小字段
  - [x] 保持数据库层使用 `snake_case`，应用层 read model / API 输出使用 `camelCase`
  - [x] 为同一任务的多个交付物建立明确索引和状态语义，避免把成品视频与字幕文件硬编码成单字段快照

- [x] 在 `app/features/deliverables/server/` 建立统一的交付物读取与访问服务 (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 新增 server-only 的 deliverable query / access service，统一处理交付物列表读取、任务归属校验、时效校验和下载授权
  - [x] 交付物访问必须经由单一授权流水线输出“受控下载”或“短时效地址”，禁止业务模块直接拼接对象存储路径
  - [x] 复用现有 `request_id`、session、RBAC 与审计能力，不新增平行鉴权逻辑

- [x] 把交付物结果接入任务详情 read model 与工作台详情视图 (AC: 1, 2, 7)
  - [x] 扩展 `app/features/tasks/server/task-query.server.ts` 的 detail read model，使其返回结果状态摘要与交付物列表，而不是让前端另查一套匿名接口
  - [x] 更新 `app/features/tasks/components/TaskDetailPanel.tsx` 与相关子组件，新增“交付结果卡”或等价模块，明确展示文件类型、状态、可下载性和下一步动作
  - [x] 对尚未完成、部分缺失、已过期或下载失败的结果状态提供内联说明与恢复/提示文案，不使用误导性的禁用按钮占位

- [x] 提供受保护的下载入口与统一错误表达 (AC: 3, 4, 5, 6)
  - [x] 在 `app/routes/` 中新增受保护的 deliverable 下载 route 或 action endpoint，并同步注册到 `app/routes.ts`
  - [x] route 层只负责 session / role 校验、调用 deliverable access service 与返回受控响应，避免在 route JSX 内散落对象存储与审计逻辑
  - [x] 下载失败时返回统一错误 envelope 或一致的错误页面表达，并保留 `request_id`

- [x] 补齐交付物访问审计与测试基线 (AC: 4, 5, 6, 7)
  - [x] 所有成功与失败下载请求都写入 `audit_logs`，至少记录 `task_id`、`deliverable_id`、`actor_user_id`、`outcome`、`request_id` 与时间
  - [x] 为交付物 query helper、访问服务、下载 route、权限拒绝、过期控制和详情页状态表达补齐测试
  - [x] 保持现有 task detail、workspace sync、auth/session 与 migration validation 测试继续通过

### Review Findings

- [x] [Review][Patch] 下载成功审计发生在文件读取之前，实际读取失败时会留下错误的 success 审计且不会记录失败路径 [/Users/reuszeng/Code/Projects/Yakimoji/app/features/deliverables/server/deliverable-access.server.ts:51]
- [x] [Review][Patch] 交付物下载审计缺少 `taskId` 关联字段，不满足“至少关联 task_id / 主体 / 时间”的 AC6 审计约束 [/Users/reuszeng/Code/Projects/Yakimoji/app/features/deliverables/server/deliverable-access.server.ts:61]
- [x] [Review][Patch] 交付物下载完全忽略 `storageKey`，固定按 `deliverable.id` 组装本地文件路径，已授权的 ready 记录也可能因为路径不匹配而下载失败 [/Users/reuszeng/Code/Projects/Yakimoji/app/features/deliverables/server/deliverable-access.server.ts:93]
- [x] [Review][Patch] 交付物测试没有覆盖失败审计路径，现有用例名声称校验 success 和 failure，但实际只断言了 success，无法拦住下载失败未落审计的回归 [/Users/reuszeng/Code/Projects/Yakimoji/tests/deliverables.test.ts:74]
- [x] [Review][Patch] 下载响应直接把原始 `fileName` 写进 `Content-Disposition`，未过滤引号或换行字符，存在响应头构造失败或注入风险 [/Users/reuszeng/Code/Projects/Yakimoji/app/routes/workspace.deliverables.$deliverableId.tsx:27]
- [x] [Review][Patch] 交付物若因 `expiresAt` 超时而不可下载，但数据库状态仍是 `ready`，详情页仍会显示“可下载/结果暂不可用”而不是“已过期”，造成状态语义与真实下载结果不一致 [/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-query.server.ts:269]

## Dev Notes

### Story Intent

- 这是 Epic 1 的“结果可交付”收口故事，不是简单给完成任务补两个下载按钮。
- 目标是让任务详情第一次真正承载“完成后能拿走什么”的产品承诺，并把交付物访问安全模型固定下来。
- 本 story 同时覆盖结果表达、下载授权、时效控制和访问审计，四者必须作为一条统一链路实现。

### Business and Epic Context

- Epic 1 的主承诺是：创作者安全进入工作台，导入任务，看懂状态，并最终拿到首个可交付结果。
- Story 1.5 已经让创作者能看懂列表、详情和状态账本；Story 1.6 已让这些状态随后台推进自动同步。
- Story 1.7 负责把“任务已完成”推进为“结果确实可拿到且访问安全”，否则 Epic 1 仍然没有闭环。

### Previous Story Intelligence

- Story 1.5 已把 `TaskDetailPanel`、`TaskStatusSummaryCard` 和时间线视图固定为任务详情主承载区，因此结果展示应扩展现有 detail stack，而不是再造一个平行结果页面。
- Story 1.5 明确要求失败态和关键操作展示 `request_id` 或等价追踪信息；下载失败与交付不可用同样必须沿用这条规则。
- Story 1.6 已经建立 SSE/轮询同步桥，只能把交付物状态变化视为现有详情数据的增量刷新目标，不应借机在前端建立第二套结果状态机。
- 当前仓库虽然已有 `app/features/deliverables/.gitkeep` 占位，但还没有真正的 deliverables schema、query 或 access service；本 story 必须显式补齐领域落地，而不是假定能力已存在。

### Git Intelligence Summary

- 最近相关提交 `02b0682 feat: complete task status sync story` 与 `7ceb109 feat: complete story 1.5 task workspace views` 说明当前仓库的稳定模式是：route 只做入口，领域逻辑收敛到 `app/features/*/server`，再用集成测试兜住跨模块契约。
- `e6bd80c Fix task lifecycle review findings` 与 `b596b9a fix: harden task intake review follow-ups` 说明该仓库对权限边界、错误表达和回归测试要求较严，不接受“先通路、后补安全”的实现顺序。
- 现有提交历史还没有任何 deliverable 落地痕迹，意味着 `1.7` 需要把 schema、server service、route、UI 和测试一起定义清楚，否则后续开发极易只完成最显眼的 UI 层。

### Architecture Compliance

- 资源边界已经在架构中明确包含 `deliverables`，并与 `tasks`、`task-events`、`api-credentials` 一样属于正式核心资源，不应被折叠成任务详情里的匿名 blob 字段。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Resource Boundary Model`]
- 交付物访问必须遵守统一错误 envelope 与 `request_id` 追踪能力；上游 SSO 的 `code/msg/data` 格式不得直接穿透到 Yakimoji 自有下载接口。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error Handling Standard`]
- 架构已明确 `object-storage` 是大文件与交付物的宿主，数据库只存元数据；前端不能经由 blob 中转大文件，下载应走受控入口或短时效访问方式。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Runtime Topology`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Performance and Bundle Strategy`]
- 前端和服务端都必须遵守“下载链路集中在统一授权/审计流水线”这一硬规则：presigned URL、受控下载代理、审计记录必须属于同一条授权流水线，业务模块禁止自行拼接对象存储地址。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Failure Scenario 7: 下载链路被不同 agent 用不同安全模型实现`]
- 本地 RBAC 和 creator ownership 仍是唯一授权真源；下载授权不能直接信任外部身份侧角色，也不能复用前端是否看得到任务作为唯一权限判断。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Pre-Mortem Derived Enforcement Rules`]
- 测试归属上，下载授权至少需要 integration 级保护，不能只靠组件测试或 service 单测证明安全边界成立。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Failure Scenario 8: 测试策略失去一致性，回归盲区扩大`]

### UX and Interaction Guardrails

- UX 文档已经把“交付结果卡”定义为核心模块，结果区必须清楚提供成品视频、字幕文件与下一步动作，而不只是显示一个“已完成”状态 pill。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-1.7`, `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Core User Experience`]
- 关键状态反馈应以内联上下文为主，toast 只用于轻量反馈。因此交付物缺失、已过期、下载失败、权限不足都必须在结果模块或错误页里有结构化说明。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#UX Design Requirements`]
- 详情信息层级仍需优先回答“当前结果是什么、哪些文件可拿、为什么暂时拿不到、下一步应该做什么”，避免把对象存储或内部流水字段暴露成用户心智。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#Transferable UX Patterns`]
- 结果状态表达必须具备文本与结构语义，不能只靠颜色区分“可下载 / 处理中 / 已过期 / 不可用”。

### Current Codebase State and Files to Update

- `database/schema/index.ts`
  - 当前状态：只导出 `health`、`auth`、`tasks`、`task-events` schema。
  - 本 story 要改：新增 `deliverables` schema 导出，确保应用层和测试能通过统一入口引用。
  - 必须保留：现有 schema 导出结构与命名方式。

- `database/schema/tasks.ts`
  - 当前状态：`tasks` 表已包含来源、基线、上传存储键与顶层状态，但没有交付物元数据。
  - 本 story 要改：不要把交付物直接塞回 `tasks` 表的 JSON 快照里；保持 `tasks` 只承载任务级元数据，结果文件进入独立 `deliverables` 资源。
  - 必须保留：既有任务状态、来源和上传字段语义。

- `app/features/tasks/server/task-query.server.ts`
  - 当前状态：详情 read model 只返回状态摘要、阶段和事件账本，没有交付物结果区。
  - 本 story 要改：扩展 detail read model，以聚合 deliverables summary 和最终结果状态。
  - 必须保留：任务归属校验、统一错误结构、时间线顺序和现有 `request_id` 处理方式。

- `app/features/tasks/components/TaskDetailPanel.tsx`
  - 当前状态：详情面板只展示返回列表、状态摘要卡和时间线。
  - 本 story 要改：把交付结果模块接入现有详情栈，并保证未选择任务时的空态文案仍然清楚。
  - 必须保留：现有详情布局、返回列表路径与 route-driven 行为。

- `app/features/tasks/server/workspace-view.server.ts`
  - 当前状态：任务详情由 workspace view model 聚合，导航中“交付”仍是 coming-soon。
  - 本 story 要改：如果需要在 view model 中补交付结果摘要，应保持任务详情仍从同一入口装配，不新开匿名查询旁路。
  - 必须保留：受保护工作台的 session / role 入口。

- `app/features/tasks/server/upload-storage.server.ts`
  - 当前状态：仅处理任务上传文件在本地 `.local-share/uploads` 的存储与删除。
  - 本 story 要改：不要把交付物下载直接复用“上传存储” helper；需要独立的 deliverable access/service，明确区分输入资产与输出交付物。
  - 必须保留：既有上传存储行为，避免误删或混用路径语义。

- `app/features/auth/server/audit.server.ts`
  - 当前状态：已提供通用 `writeAuditLog` 能力，记录 `request_id`、主体、资源与结果。
  - 本 story 要改：交付物访问成功/失败都应通过该能力或其轻量封装落库。
  - 必须保留：统一审计写入入口，不要在下载 route 内部直接写 SQL。

- `app/routes/workspace.tsx` 与 `app/routes/workspace.task-detail.tsx`
  - 当前状态：两条受保护 route 共用 `loadWorkspaceViewModel`，详情路由已有结构化错误边界。
  - 本 story 要改：若结果区依赖额外 detail 数据，继续走现有 loader 入口；不要把下载或结果状态单独暴露给未鉴权页面。
  - 必须保留：受保护边界和现有错误页模式。

- `app/routes.ts`
  - 当前状态：已显式注册 `workspace`、`workspace/tasks/:taskId`、`workspace/task-sync` 等路由。
  - 本 story 要改：新增 deliverable 下载 route 或 action endpoint 时必须显式注册。
  - 必须保留：当前 route 组织风格与受保护工作台入口。

### Recommended File Structure

- 新增交付物服务端逻辑优先放在 `app/features/deliverables/server/`，例如：
  - `deliverable-query.server.ts`
  - `deliverable-access.server.ts`
  - `deliverable-contract.server.ts`
- 若需要 UI 子组件，优先放在 `app/features/deliverables/components/` 或 `app/features/tasks/components/` 下的 task-detail 相关组件，而不是塞进 `shared/ui/`
- 新增 route 建议保持 React Router 约定式命名，例如：
  - `app/routes/workspace.deliverables.$deliverableId.ts`
  - 或 `app/routes/workspace.tasks.$taskId.deliverables.$deliverableId.ts`
- migration 与 schema 变更继续放在 `drizzle/` 与 `database/schema/` 体系下，不在 feature 目录自行维护 SQL

### Data and Access Model Guidance

- `deliverables` 资源推荐最少字段：
  - `id`
  - `taskId`
  - `kind`：如 `video`, `subtitle`
  - `status`：如 `pending`, `ready`, `expired`, `unavailable`
  - `storageKey`
  - `mimeType`
  - `fileSizeBytes`
  - `fileName`
  - `availableAt`
  - `expiresAt`
  - `metadata`
- 详情 read model 推荐新增：
  - `resultStatus`
  - `deliverables[]`
  - 每个 deliverable 的 `kindLabel`、`statusLabel`、`canDownload`、`downloadHref` 或 `requestDownloadAction`
- 下载访问模式建议二选一并统一：
  - 受保护 route 做鉴权后直接流式代理文件
  - 或受保护 route 做鉴权与审计后返回短时效 presigned URL / 302 跳转
- 无论哪种模式，都必须由统一 access service 负责授权、时效和审计，不能分散到多个业务 helper

### Implementation Guardrails

- 不要把交付物元数据塞回 `tasks.processingBaselineSnapshot`、`sourceSnapshot` 或其他现有 JSON 字段里凑合实现。
- 不要把对象存储 key 或长期可访问 URL 直接返回给前端组件。
- 不要让详情页只凭“任务是 completed”就默认显示下载入口；交付物 readiness 和可访问性必须单独判断。
- 不要用匿名文件路由或静态文件目录暴露结果文件。
- 不要把下载审计只记成功不记失败；权限拒绝、过期、缺失同样需要审计。
- 不要为了省事把交付物访问逻辑堆进 `upload-storage.server.ts` 或 `task-intake.server.ts`。
- 不要绕过现有 `request_id` / error boundary 模式，让下载错误成为无追踪的裸 500。

### Testing Requirements

- 必须覆盖：
  - `deliverables` schema / migration 与 query helper 的基本契约
  - 任务详情 read model 会返回结果状态与交付物列表
  - 非本人任务或交付物访问被拒绝，并返回 403/404 且不泄露存储地址
  - 下载成功时写入审计日志
  - 下载失败、结果缺失、交付物过期时仍写入审计日志并返回统一错误表达
  - 详情页对“可下载 / 暂不可用 / 已过期 / 尚未生成”有清晰文本表达，不误展示入口
- 至少保留并继续通过：
  - `tests/task-query.test.ts`
  - `tests/task-sync.test.ts`
  - `tests/e2e/workspace-shell.test.mjs`
  - `tests/auth-flow.test.ts`
  - `tests/session.test.ts`
- 完成后运行：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### Latest Technical Information

- 截至 2026-05-26，React Router Framework Mode 仍要求把需要鉴权与敏感资源访问的数据读取放在 route loader / server helper 上，`loader` 中的服务器逻辑不会进入 client bundle，因此交付物授权与下载入口继续放在受保护 route + `.server` helper 中是当前正确模式。[Official: `https://reactrouter.com/start/framework/data-loading`]
- MDN 对 Server-Sent Events 的最新说明仍强调服务端响应应使用 `text/event-stream`，适合通知 `deliverable.ready` 这类单向事件；因此后续若把交付物 ready 状态接入 Story 1.6 的同步桥，应只作为 revalidation 信号，不应成为客户端私有结果真源。[Official: `https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events`]
- OpenAPI 官方最新主规范为 `3.2.0`，架构文档也已选定以 OpenAPI 为主文档策略；如果本 story 顺手补充内部/外部下载契约文档，应沿用同一规范族而不是自定义接口说明格式。[Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#API Documentation Strategy`]
- AWS S3 官方文档仍将 presigned URL 作为临时授权访问方式，重点在有限时效与签名控制；这与本项目“短时效访问而非长期公共 URL”的安全约束一致，但前提仍是必须经由 Yakimoji 自己的授权/审计流水线发放，而不是由前端直接生成或长期缓存。[Official: `https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html`]

### Project Context Reference

- 通过 workflow `persistent_facts` 约定的 `project-context.md` 全仓扫描未找到匹配文件。
- 当前可用项目上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-5-creator-task-list-and-detail-status-views.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-6-task-status-sync-via-sse-with-polling-fallback.md`
- 仓库协作约定仍需遵守：
  - 路径优先使用绝对路径
  - 破坏性操作前先说明并二次确认
  - 跨工具通用知识写入 `knowledge/`，流程写入 `skills/`

### References

- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-1.7`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/prd.md#Functional-Requirements`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Resource Boundary Model`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Error Handling Standard`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Runtime Topology`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Performance and Bundle Strategy`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Failure Scenario 7: 下载链路被不同 agent 用不同安全模型实现`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Failure Scenario 8: 测试策略失去一致性，回归盲区扩大`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Pre-Mortem Derived Enforcement Rules`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#API Documentation Strategy`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/components/TaskDetailPanel.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/task-query.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/workspace-view.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/tasks/server/upload-storage.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/features/auth/server/audit.server.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/workspace.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/routes/workspace.task-detail.tsx`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/app/routes.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/index.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/tasks.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/task-events.ts`]
- [Source: `/Users/reuszeng/Code/Projects/Yakimoji/database/schema/auth.ts`]
- [Official: `https://reactrouter.com/start/framework/data-loading`]
- [Official: `https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events`]
- [Official: `https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html`]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Loaded workflow configuration, sprint status, template, checklist, and BMM config before selecting the target backlog story
- Exhaustively analyzed epic 1 story 1.7 requirements, PRD, architecture, UX specification, and prior story 1.5 / 1.6 implementation artifacts
- Read current task detail, workspace view, upload storage, audit logging, route manifest, and database schema files to identify actual update targets and missing deliverables infrastructure
- Verified the story context against current repository state so the implementation guide reflects the real codebase rather than assumed modules
- Added a dedicated `deliverables` schema, migration, query service, access service, protected download route, and task detail UI result card
- Verified the completed implementation with `pnpm test`, `pnpm typecheck`, and `pnpm build`

### Completion Notes List

- Implemented `deliverables` as a first-class persisted resource with snake_case storage fields and camelCase read models
- Extended task detail read models and UI to show result delivery status, file-level availability, expiration context, and controlled download actions
- Added a protected download route backed by a unified deliverable access service so authorization, expiry handling, request_id propagation, and audit logging stay in one pipeline
- Added deliverables regression coverage and preserved the existing task/auth/workspace regression suite green

### Change Log

- 2026-05-26: 完成交付物模型、受保护下载入口、任务详情交付结果卡与审计/测试基线，实现 Story 1.7 并推进到 review

### File List

- _bmad-output/implementation-artifacts/1-7-completed-deliverables-and-secure-result-access.md
- app/app.css
- app/features/deliverables/server/deliverable-access.server.ts
- app/features/deliverables/server/deliverable-query.server.ts
- app/features/tasks/components/TaskDeliverablesCard.tsx
- app/features/tasks/components/TaskDetailPanel.tsx
- app/features/tasks/server/task-query.server.ts
- app/routes.ts
- app/routes/workspace.deliverables.$deliverableId.tsx
- database/schema/deliverables.ts
- database/schema/index.ts
- drizzle/0006_gleaming_harvest.sql
- drizzle/meta/_journal.json
- tests/deliverables.test.ts
- tests/task-query.test.ts
