# Story 1.6: Task Status Sync via SSE with Polling Fallback

Status: done

## Story

As a 创作者,
I want 工作台中的任务状态在后台推进时自动更新,
So that 我不需要频繁手动刷新页面才能跟上处理进度。

## Acceptance Criteria

1. **Given** 任务在后台从一个处理阶段推进到下一个处理阶段  
   **When** 后台真实状态发生变化  
   **Then** 工作台中的列表与详情状态必须在约定时限内同步更新  
   **And** 不得要求用户手动刷新才能看到正常状态变化
2. **Given** 系统运行在支持 SSE 的正常环境中  
   **When** 创作者停留在任务列表或任务详情页  
   **Then** 系统必须优先通过 SSE 推送状态变化通知  
   **And** 前端必须通过统一的缓存失效、revalidation 或等价受控更新路径消费这些通知，而不是在组件里手搓第二套状态机
3. **Given** SSE 通道不可用、断开、浏览器不支持或部署环境不适配 SSE  
   **When** 系统无法维持正常事件推送  
   **Then** 前端必须退回到轮询兜底模式  
   **And** 兜底模式仍需满足既定的状态同步时限边界
4. **Given** 创作者只拥有自己的任务访问权限  
   **When** 同步机制更新列表、详情或状态摘要  
   **Then** 只允许当前用户可见任务进入同步范围  
   **And** 不得在同步层泄露其他用户任务或扩散完整事件历史

## Tasks / Subtasks

- [x] 建立任务状态同步的服务端边界与事件 contract (AC: 1, 2, 3)
  - [x] 在 `app/features/tasks/server/` 新增专用 sync helper，统一封装 SSE 事件格式、状态摘要读取和轮询所需的最小读模型
  - [x] 继续复用 `app/features/tasks/server/task-status.server.ts` 作为唯一状态真源，不新增第二套状态枚举或同步语义
  - [x] 事件内容只承载缓存更新信号和必要元数据，不把完整业务状态机塞进事件 payload

- [x] 实现 SSE 推送端点与事件流路由 (AC: 2)
  - [x] 在 `app/routes/` 增加专用 SSE 路由，并同步注册到 `app/routes.ts`
  - [x] 路由仅负责鉴权、流式响应和事件转发，业务映射留在 `features/tasks/server`
  - [x] 输出 `text/event-stream`，保持单向推送，不把客户端请求回写进同一通道

- [x] 实现轮询兜底与同步桥接层 (AC: 1, 3)
  - [x] 为支持 SSE 失败的环境提供轮询 fallback
  - [x] 轮询只拉取当前工作台可见任务的最小状态摘要或定向变更，不轮询全量事件账本
  - [x] 将 SSE 到达和轮询刷新统一收敛为同一套 revalidation / cache invalidation 入口，避免三套刷新路径并存

- [x] 把同步能力接入工作台列表与详情页 (AC: 1, 2, 3, 4)
  - [x] 在 `CreatorWorkspaceScreen` 或其领域子组件中接入同步桥接层
  - [x] 任务列表与详情保持 route-driven 读取真源，live sync 只负责触发局部更新
  - [x] 增加非侵入式同步提示，明确区分“正在同步”“已回退轮询”“连接断开重试中”，但不要把 toast 当成状态真源

- [x] 补齐同步行为测试与回归保护 (AC: 1, 2, 3, 4)
  - [x] 覆盖 SSE 事件格式、路由响应头、断线重连/轮询切换和受保护任务范围
  - [x] 覆盖列表与详情在同步触发后会刷新受影响数据，而不是重建第二套本地状态
  - [x] 保持现有 workspace、task-query、task-intake 和 auth/session 测试继续通过

## Dev Notes

### Story Intent

- 这是 Epic 1 的“状态自动跟进”故事，不是重新建状态模型，也不是重做列表/详情。
- 目标是让任务列表和任务详情在后台推进时保持近实时一致，同时保留 route loader / action 的单点真源。
- 只做单向同步，不做双向实时协作，不做编辑器型交互。

### Epic Context

- Epic 1 的主线是：安全进入工作台、导入任务、看懂状态、拿到首个可交付结果。
- Story 1.4 已建立 `tasks + task_events` 的统一真源。
- Story 1.5 已把任务列表、详情和状态账本展示出来；Story 1.6 负责把这些展示保持“活的”。

### Previous Story Intelligence

- Story 1.4 已明确顶层任务状态只能来自 `app/features/tasks/server/task-status.server.ts`，`task_events` 只承载更细粒度事件。
- Story 1.5 已确认列表页只读分页摘要、详情页才读完整账本；本 story 不能把同步退化成全量历史轮询。
- 当前工作台和 task detail 都是 route-driven，SSE / polling 只能作为增量更新信号，不能替代 loader 数据。

### Git Intelligence Summary

- 最近相关提交 `7ceb109`、`e6bd80c`、`b596b9a`、`c261726` 都说明仓库偏好“领域逻辑收敛到 `app/features/*/server`，route 只做入口”。
- `workspace` / `workspace.task-detail` 已经是稳定的受保护入口，新增同步能力应优先复用这条路径，而不是再开一套平行页面。
- 现有测试风格偏向 server helper + route integration + e2e 字符串保护，新增同步能力也应沿用这条路线。

### Architecture Compliance

- 前端必须遵循 React Router Framework Mode 的 route-driven 数据加载模式，首屏 bootstrap 继续由 `loader` 负责。
- 状态管理采用路由状态、客户端缓存和本地 UI 状态三层分离；SSE 只能作为缓存更新信号或 revalidation 信号。
- 任务列表必须分页，任务事件流按需加载，轮询兜底不得把完整事件历史一次性拉进前端。
- SSE 是单向事件通知，不是双向协议；断开时必须有轮询兜底。
- 本地 RBAC 仍是唯一授权真源，同步层不得越权暴露其他用户任务。

### Current Codebase State and Files to Update

- `app/routes/workspace.tsx`
  - 当前状态：受保护工作台入口，loader 提供列表/详情 bootstrap 数据，action 仍承接任务导入。
  - 本 story 要改：必要时挂接同步入口或状态桥接点，但不要改写 existing loader / action 的职责。
  - 必须保留：`requireUserSession`、`requireRole`、`requestId`、`/workspace` 默认入口和 logout 流程。

- `app/routes/workspace.task-detail.tsx`
  - 当前状态：任务详情直达路由，复用同一工作台模型。
  - 本 story 要改：如需 route 级同步挂钩，应保持详情路由可直达、可刷新、可分享。
  - 必须保留：受保护边界和现有 detail loader 语义。

- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
  - 当前状态：组合 workspace shell、任务列表与详情面板。
  - 本 story 要改：把同步桥接层接入这里或其更细的领域子组件。
  - 必须保留：现有 workspace shell、导入动作和详情布局。

- `app/features/tasks/components/TaskListPanel.tsx`
  - 当前状态：展示分页任务列表，只读分页摘要和最近关键进展。
  - 本 story 要改：只接收同步后的刷新结果，不在组件里自维护任务状态机。
  - 必须保留：分页、键盘可达性和 route-driven 导航。

- `app/features/tasks/components/TaskDetailPanel.tsx`
  - 当前状态：展示详情摘要、状态卡和时间线。
  - 本 story 要改：同步更新应驱动详情摘要和时间线 revalidation。
  - 必须保留：直达详情、返回列表和阶段语义展示。

- `app/features/tasks/server/task-query.server.ts`
  - 当前状态：承担分页列表、详情读取和事件账本读取。
  - 本 story 要改：补一个最小同步读模型或状态摘要 helper，供 SSE / polling 共用。
  - 必须保留：现有分页和权限语义，不要把全量账本读进同步通道。

- `app/features/tasks/server/task-status.server.ts`
  - 当前状态：唯一顶层状态枚举与阶段语义真源。
  - 本 story 要改：如需新增同步提示文案映射，只能围绕现有状态做，不得新增状态语义。
  - 必须保留：状态枚举、阶段映射和转移规则。

- `app/routes.ts`
  - 当前状态：仅显式注册 workspace、task detail 等路由。
  - 本 story 要改：如新增 SSE 或 polling endpoint，需要在这里完成显式注册。
  - 必须保留：已有认证、回调、登出、健康检查路由。

### Recommended File Structure

- 新增同步相关 server 逻辑优先放在 `app/features/tasks/server/`，例如：
  - `task-sync.server.ts`
  - `task-status-sync.server.ts`
  - `task-polling.server.ts`
- 新增 SSE / polling 端点优先放在 `app/routes/`，保持 route 文件薄、领域逻辑厚。
- 如果需要 UI 提示，优先新增小型领域组件或 hook，而不是把同步逻辑塞回 `WorkspaceShell`。

### SSE / Polling Design Rules

- SSE 只发送任务状态变化、关键进展和必要元数据，不发送完整任务历史。
- 事件名保持 `dot.case` 风格，并与任务状态真源一致。
- 前端收到事件后，只能做定向 revalidation / query invalidation / cache update。
- 轮询兜底只在 SSE 不可用、断开或浏览器不支持时启用。
- 轮询间隔应可控，且在页面离开、切后台或路由切换时停止。
- 任何同步失败都应回退成可理解的状态提示，但不要污染任务状态真值。

### Implementation Guardrails

- 不要新增第二套任务状态枚举或前端专用状态字符串。
- 不要让 SSE 直接驱动组件内部长期业务 state。
- 不要把轮询做成全量账本拉取。
- 不要把同步逻辑散落在多个组件里。
- 不要绕过 `task-status.server.ts` 去拼任务状态文案。
- 不要破坏现有列表/详情/导入测试。

### Testing Requirements

- 必须覆盖：
  - SSE 响应头与事件流格式
  - 事件到达后仅刷新受影响的列表/详情数据
  - SSE 不可用时自动切换轮询
  - 轮询只读取最小必要状态摘要
  - 非本人任务不会进入同步范围
- 至少保留并继续通过：
  - `tests/workspace-view.test.ts`
  - `tests/task-query.test.ts`
  - `tests/e2e/workspace-shell.test.mjs`
  - `tests/auth-flow.test.ts`
  - `tests/session.test.ts`

### Latest Technical Information

- React Router 官方 Data/Framework Mode 仍把 `loader` 作为首屏数据加载主轴，client navigation 会触发自动 fetch，因此受保护工作台的 bootstrap 仍应优先放在 route loader 中。
- TanStack Query 官方当前仍推荐用 `invalidateQueries` 做定向失效和后台 refetch，而不是手工维护归一化缓存；如果本 story 引入缓存层，应围绕局部失效设计。
- MDN 仍把 SSE 定义为 `EventSource` 驱动的单向服务器推送，服务端响应应使用 `text/event-stream`，适合作为任务状态通知通道。

### Project Context Reference

- 通过 workflow `persistent_facts` 约定的 `project-context.md` 未找到匹配文件。
- 当前可用项目上下文来自：
  - `/Users/reuszeng/Code/Projects/Yakimoji/AGENTS.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-4-task-lifecycle-state-model-and-persistent-event-ledger.md`
  - `/Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-5-creator-task-list-and-detail-status-views.md`

### References

- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/epics.md#Story-1.6]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#SSE Event Contract]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#State Management Approach]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#Performance and Bundle Strategy]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/architecture.md#High-Risk Divergence Pre-Mortem]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/planning-artifacts/ux-design-specification.md#流程阶段时间线--状态账本]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-4-task-lifecycle-state-model-and-persistent-event-ledger.md]
- [Source: /Users/reuszeng/Code/Projects/Yakimoji/_bmad-output/implementation-artifacts/1-5-creator-task-list-and-detail-status-views.md]
- [Official: https://reactrouter.com/start/framework/data-loading]
- [Official: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation]
- [Official: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events]
- [Official: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events]
## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Reviewed sprint status, story 1.6 requirements, prior story 1.5 implementation, and workspace/task server boundaries before coding
- Implemented server-side sync helper and thin SSE/polling route split to keep client bundle free of server-only session/auth imports
- Added client sync bridge with SSE-first behavior, polling fallback, and route-driven revalidation
- Added regression coverage for sync envelope, route response headers, and source-level route manifest checks
- Verified with `pnpm test`, `pnpm typecheck`, and `pnpm build`

### Completion Notes List

- Added `app/features/tasks/server/task-sync.server.ts` to produce the minimal sync envelope and SSE delta event contract from visible creator tasks only
- Added `app/routes/workspace.task-sync.server.ts` plus thin `app/routes/workspace.task-sync.ts` loader entry to serve SSE and polling responses without leaking server-only code into the client bundle
- Added `TaskSyncBridge` to trigger route revalidation on SSE events and fall back to polling when EventSource is unavailable or fails
- Updated the workspace shell layout so sync status appears as a non-invasive status panel above the task list while preserving route-driven list/detail rendering
- Added regression tests for sync contract, route polling payloads, and workspace shell/source-level route coverage
- Validation completed successfully: `pnpm test`, `pnpm typecheck`, `pnpm build`

## Completion Notes

- Implemented task status sync via SSE with polling fallback and kept list/detail updates route-driven.
- Fixed fallback retry behavior to keep polling alive after transient failures.
- Verified with `pnpm test` and `pnpm typecheck`.

## Change Log

- 2026-05-26: Implemented story 1.6 SSE sync, polling fallback, and workspace bridge; moved story to review.
- 2026-05-26: Fixed review feedback, verified tests, and marked story done.

## File List

- _bmad-output/implementation-artifacts/1-6-task-status-sync-via-sse-with-polling-fallback.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/app.css
- app/features/tasks/components/CreatorWorkspaceScreen.tsx
- app/features/tasks/components/TaskSyncBridge.tsx
- app/features/tasks/server/task-sync.server.ts
- app/features/tasks/task-sync.shared.ts
- app/routes.ts
- app/routes/workspace.task-sync.server.ts
- app/routes/workspace.task-sync.ts
- tests/e2e/workspace-shell.test.mjs
- tests/task-sync-route.test.ts
- tests/task-sync.test.ts
- tsconfig.vite.tsbuildinfo
