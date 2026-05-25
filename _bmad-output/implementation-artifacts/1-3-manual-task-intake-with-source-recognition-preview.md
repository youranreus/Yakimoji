# Story 1.3: Manual Task Intake with Source Recognition Preview

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 通过粘贴 YouTube 链接或上传视频创建任务并看到来源识别结果,
so that 我能在提交处理前确认系统识别到了正确的来源与关键设置。

## Acceptance Criteria

1. **Given** 创作者已登录并进入工作台  
   **When** 创作者打开任务导入入口  
   **Then** 页面必须同时提供 YouTube 链接导入与视频文件上传两种入口  
   **And** 该入口在桌面端应作为清晰的主行动区域呈现
2. **Given** 创作者输入有效的 YouTube 链接  
   **When** 系统接收并校验输入  
   **Then** 系统必须创建一个待处理任务草稿或等价的创建上下文  
   **And** 开始执行来源识别并向用户展示识别中的反馈状态
3. **Given** 创作者上传受支持的视频文件  
   **When** 上传开始并通过基础校验  
   **Then** 系统必须创建一个待处理任务草稿或等价的创建上下文  
   **And** 开始执行来源识别并向用户展示上传中与识别中的反馈状态
4. **Given** 来源识别成功  
   **When** 系统拿到可用于任务创建的来源信息  
   **Then** 创作者必须能看到识别到的来源信息与将要生效的关键任务设置摘要  
   **And** 这些摘要至少应覆盖来源标识和当前任务将采用的默认处理基线
5. **Given** 创作者查看任务创建确认区域  
   **When** 系统已完成来源识别  
   **Then** 创作者必须能在正式提交处理前确认当前任务的关键设置  
   **And** 不要求在本 story 中提供频道预设编辑、字幕模板覆盖或翻译风格配置能力
6. **Given** 创作者确认提交任务  
   **When** 创建请求成功写入系统  
   **Then** 系统必须生成可在工作台中查看的任务记录  
   **And** 任务应进入后续处理链路可消费的初始状态，而不是停留在仅前端可见的临时对象
7. **Given** 创作者输入无效链接、上传失败或来源识别失败  
   **When** 系统无法形成可继续的任务创建上下文  
   **Then** 页面必须以内联方式展示明确错误说明  
   **And** 用户可以重新输入、重新上传或重试，而不会误以为任务已成功提交
8. **Given** 创作者在桌面端高频使用任务导入入口  
   **When** 导入表单和识别反馈渲染  
   **Then** 该流程必须遵循渐进暴露原则与可访问性基线  
   **And** 不得退化为需要用户先填写复杂配置的大表单

## Tasks / Subtasks

- [x] 建立 Story 1.3 所需的最小任务持久化模型与迁移产物 (AC: 2, 3, 4, 6)
  - [x] 新增 `database/schema/tasks.ts` 或等价 tasks domain schema，至少补齐 `tasks` 主表的 MVP 字段：`creator_user_id`、`intake_method`、`source_url`、`source_identifier`、`source_snapshot`、`upload_storage_key`、`status`、`created_at`、`updated_at`
  - [x] 为上传文件只保存对象存储键或等价服务器端引用，禁止把视频二进制塞进 PostgreSQL
  - [x] 继续通过 `database/schema/index.ts` 汇总 schema，并生成新的 `drizzle/*.sql` 与 `drizzle/meta/*`
  - [x] 不要在本 story 抢跑实现完整 `task_events` 账本；若需要初始状态字段，必须复用一处统一任务状态定义，并与架构推荐枚举兼容
- [x] 在 `features/tasks` 内实现受保护的任务导入与来源识别服务边界 (AC: 2, 3, 4, 7)
  - [x] 新增 server-only 模块，例如 `app/features/tasks/server/task-intake.server.ts`、`source-recognition.server.ts`、`upload-storage.server.ts`
  - [x] 将 YouTube 链接校验、文件基础校验、草稿上下文创建、来源识别调用与确认前摘要组装收敛在 tasks domain，而不是散落在 route 组件里
  - [x] 所有失败返回统一结构化错误，并保留 `request_id`，保证工作台内联错误与后续支持排障可关联
  - [x] 如果上传路径当前只能得到“不足以识别来源”的结果，必须返回明确的识别失败或未知来源状态，不能伪造成功来源
- [x] 将受保护工作台壳层演进为桌面优先的任务导入主行动区 (AC: 1, 4, 5, 8)
  - [x] 在 `app/routes/workspace.tsx` 上承载或挂接任务导入 action，不要为 Web-only 预览流程额外暴露匿名公共接口
  - [x] 演进 `app/shared/ui/WorkspaceShell.tsx`，让“任务导入”成为主内容区的一等模块，同时保留 Story 1.2 已建立的身份、导航和安全边界表达
  - [x] 扩展 `app/app.css` 以实现 Process Ledger 方向的主行动区、识别中状态、确认摘要区和内联错误区，不要把页面退化成后台表单墙
  - [x] 预留“最近创建任务”或“刚提交任务”可见位，满足 AC6 的“工作台中可查看任务记录”，但不要提前实现完整任务列表或详情页
- [x] 按架构指定的表单策略落地双入口导入交互 (AC: 1, 2, 3, 5, 8)
  - [x] 任务导入属于复杂表单，优先使用 `react-hook-form` + `zod` 建模双入口表单值与字段错误映射；服务端 schema 仍是最终真源
  - [x] 对“不改变 URL 的预览/识别”步骤使用 `useFetcher` / `<fetcher.Form>` 或 `navigate={false}` 模式，不要让预览步骤制造无意义的 history 记录
  - [x] 文件上传表单必须使用 `encType=\"multipart/form-data\"`
  - [x] 对大文件上传不要直接依赖裸 `request.formData()` 缓冲整文件；优先采用 React Router 官方 how-to 推荐的流式 parser / upload handler 包装
- [x] 完成“识别成功 -> 确认摘要 -> 持久化任务记录”的闭环 (AC: 4, 5, 6)
  - [x] 识别成功后展示来源标识与当前默认处理基线摘要；这里的“默认处理基线”应是真实当前系统默认值，不能提前伪装成 Story 2 的 preset 命中结果
  - [x] 创作者确认后，必须落一条真实 `tasks` 记录并进入后续链路可消费的初始状态
  - [x] 若此时尚未接入 worker / queue，只能把任务写成后续 story 可继续推进的明确状态，禁止停留在 React state 或未持久化 draft
  - [x] 成功后在当前工作台立即可见任务记录摘要，避免用户误以为请求丢失
- [x] 补齐 Story 1.3 的验证、测试与文档 (AC: 1, 6, 7, 8)
  - [x] 新增 tasks domain 测试，覆盖有效 YouTube 链接、无效链接、上传校验失败、识别失败、确认创建成功和结构化错误中的 `request_id`
  - [x] 更新 `tests/e2e/workspace-shell.test.mjs`，把断言从“只有壳层”推进到“壳层 + 任务导入主行动区”，同时保留 Story 1.2 的安全边界文案意图
  - [x] 保持 `tests/auth-flow.test.ts`、`tests/session.test.ts`、`tests/api/health-route.test.mjs`、`tests/scaffold.test.mjs` 继续通过
  - [x] 至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`、`pnpm db:migrate`

### Review Findings

- [x] [Review][Patch] Hostname 后缀校验会把 `notyoutube.com` 这类域名误判为 YouTube 链接 [app/features/tasks/server/source-recognition.server.ts:52]
- [x] [Review][Patch] 上传路径直接用文件名构造“已识别来源”，违反“不能伪造成功来源”的 story 约束 [app/features/tasks/server/source-recognition.server.ts:75]
- [x] [Review][Patch] 预览草稿只存在进程内 `Map`，重启后确认必然失效且没有过期清理策略 [app/features/tasks/server/task-intake.server.ts:86]
- [x] [Review][Patch] 同一个 `draftToken` 并发确认时会重复落库，双击或重试可创建重复任务 [app/features/tasks/server/task-intake.server.ts:300]
- [x] [Review][Patch] 上传文件先整体读入内存再写盘，且预览放弃或确认失败后不会清理孤儿文件 [app/features/tasks/server/upload-storage.server.ts:16]
- [x] [Review][Patch] intake 错误通过 `throw data()` 进入路由错误边界，无法按 AC7 以内联方式留在工作台中展示 [app/features/tasks/server/task-errors.server.ts:43]
- [x] [Review][Patch] 上传请求缺少 `multipart/form-data` 时会被误判成 YouTube 链接错误，而不是明确的上传失败 [app/features/tasks/server/task-intake.server.ts:353]

## Dev Notes

### Story Intent

- 这不是“在工作台上加一个输入框”的 story，而是 Epic 1 第一条真正把任务域引入到受保护工作台中的实现。
- Story 1.3 需要把“已登录创作者 -> 任务导入 -> 来源识别预览 -> 确认提交 -> 持久化任务记录”串成闭环，为 Story 1.4 的统一状态模型、Story 1.5 的任务列表/详情和 Story 2 的 preset 命中打地基。
- 本 story 的重点是任务入口与来源预览，不是完整处理编排，也不是 preset 管理。不要提前把 Story 2 或 Story 1.5/1.6 的范围偷带进来。

### Epic Context

- Epic 1 的业务目标是让创作者安全登录、导入任务、理解状态并最终拿到首个可交付结果；Story 1.3 是“从壳层进入任务域”的第一步。
- Story 1.3 对后续故事的直接依赖关系：
  - Story 1.4 会复用这里落下的 `tasks` 主表、任务初始状态和来源识别结果，补上统一状态机与 `task_events`
  - Story 1.5/1.6 会复用这里生成的真实任务记录来渲染列表、详情和状态同步
  - Story 2.1/2.2 会复用这里的来源识别输出和任务默认处理基线，接入频道预设管理与自动命中

### Previous Story Intelligence

- Story 1.2 已经建立好本地 session、RBAC、`request_id` 与受保护 `/workspace` 壳层；Story 1.3 必须在这些现有 server-only 边界上扩展，而不是新造第二套 auth 或 request context 流程。
- Story 1.2 的工作台目前仍是“安全壳层 + 占位主内容”，`app/routes/workspace.tsx` 与 `app/shared/ui/WorkspaceShell.tsx` 都刻意为本 story 预留了主行动区。
- Story 1.1/1.2 的共同经验：
  - 不要让缺失数据库或环境变量的行为污染公开健康检查与现有认证测试
  - 不要把本该持久化在数据库或服务器端的状态放回客户端临时对象
  - 文档、测试和实现必须保持诚实一致，不能把“未来会接入”的内容写成“已经可用”

### Git Intelligence Summary

- 最近相关提交集中在“受保护工作台 + 认证/会话闭环 + 结构化测试”：
  - `814aa04 feat: implement story 1.2 auth workspace shell` 建立了 `/workspace` 受保护入口、auth server helpers、最小 RBAC 和工作台壳层
  - `8f02213 fix: tighten auth bootstrap and callback handling` 收紧了 session bootstrap、callback 和健康检查回归风险
- 可操作结论：
  - 继续沿用 route-first + server helper 模式，不要在客户端堆第二套任务状态机
  - 继续把高风险逻辑做成可单测的 server helper，而不是只靠 route JSX 隐式行为
  - 继续把 request-scoped 行为挂在现有 `request_id` / `DatabaseContext` 链路上

### Architecture Compliance

- 任务域与权限边界：
  - 任务导入必须发生在已认证的 creator 工作台内，继续复用 Story 1.2 的 `requireUserSession` / `requireRole`
  - `request_id` 必须贯穿识别失败、上传失败与确认失败，保证错误 UI、日志与审计可追踪
- 数据建模边界：
  - 架构指定核心模型是 `tasks`、`task_events`、`channel_presets`、`deliverables`、`audit_logs`
  - 本 story 只应引入 `tasks` 主表的 MVP 字段，不要提前把完整事件账本、deliverable 或 API credential 模型一次性做完
- 状态语义边界：
  - 顶层任务状态必须与架构推荐枚举兼容：`created`、`resolving_source`、`matching_preset`、`awaiting_preset_decision`、`queued`、`processing`、`awaiting_human_review`、`failed`、`completed`、`cancelled`
  - 本 story 若需要任务初始状态，只能从这套统一语义中取值，禁止发明临时前端状态名
- 前端与表单边界：
  - 复杂任务创建表单遵循 `React Router + RHF + Zod` 分工
  - 共享 server state 才考虑 Query 缓存；不要仅为本地表单瞬时状态引入全局状态管理

### Current Codebase State and Files to Update

- `app/routes/workspace.tsx`
  - 当前状态：受保护 loader 返回身份、导航与占位 panels，没有 tasks action 或任务记录可见性
  - 本 story 要改：承载或挂接任务导入 action、识别反馈与“刚创建任务”展示
  - 必须保留：现有 creator 鉴权、`requestId`、错误边界与 logout affordance
- `app/shared/ui/WorkspaceShell.tsx`
  - 当前状态：纯壳层展示，主内容仍是占位文本
  - 本 story 要改：让任务导入成为主行动区，同时保持安全边界、身份卡和 Process Ledger 风格
  - 必须保留：桌面优先、克制可信的工作台气质
- `app/app.css`
  - 当前状态：只覆盖壳层、导航、身份卡和基础错误页样式
  - 本 story 要改：增加导入入口、识别中状态、确认卡、内联错误、最近创建任务摘要的视觉规则
  - 必须保留：近中性色、强排版、低噪音表达，不要做成营销首页或重后台
- `database/schema/index.ts`
  - 当前状态：只汇总 auth / health schema
  - 本 story 要改：挂入 tasks schema
  - 必须保留：现有 auth schema 与迁移历史
- `app/features/tasks/`
  - 当前状态：只有空目录占位
  - 本 story 要改：放入任务导入、来源识别、上传存储等领域私有代码
  - 必须保留：领域代码留在 `features/tasks`，不要丢进 `shared/lib`
- `server/app.ts` 与 `app/features/auth/server/request-context.server.ts`
  - 当前状态：已经提供 `DatabaseContext` 与 `request_id`
  - 本 story 要改：通常无需改架构，只需复用
  - 必须保留：不要绕开这两条请求级上下文链路
- `tests/e2e/workspace-shell.test.mjs`
  - 当前状态：断言工作台壳层和安全边界文案
  - 本 story 要改：让测试同时覆盖任务导入主行动区
  - 必须保留：壳层仍然是受保护工作台，而不是匿名首页

### Data Modeling Guidance

- 推荐 `tasks` 最小字段：
  - `id`
  - `creator_user_id`
  - `intake_method`：至少区分 `youtube_link` / `video_upload`
  - `status`
  - `source_url`：仅链接导入使用
  - `upload_storage_key`：仅上传导入使用
  - `source_identifier`
  - `source_snapshot`：JSON，保存识别到的来源与确认摘要快照
  - `processing_baseline_snapshot`：JSON，保存当前默认处理基线快照
  - `created_at` / `updated_at`
- 推荐约束：
  - 数据库字段使用 `snake_case`
  - API / action 返回字段使用 `camelCase`
  - `status` 必须走共享枚举映射
  - 二进制文件绝不入库
- 推荐上传存储边界：
  - 先抽象为 `upload-storage.server.ts`
  - 本地开发可接本地文件存储或临时目录
  - 生产目标仍然是架构指定的 S3-compatible object storage

### Route and Interaction Strategy

- 任务导入预览属于“当前上下文内、不应改 URL”的交互。按 React Router 官方 `Form vs. fetcher` 指南，这类动作应优先使用 `useFetcher` / `<fetcher.Form>`，而不是制造新的导航历史。
- 可以采用单 route 多 `intent` 的 action 设计，也可以把受保护的 intake action 拆到 workspace 子路由；但无论哪种，都应挂在现有受保护层级之下。
- 推荐交互分为两段：
  - 第一步：提交链接或文件，创建草稿上下文并返回识别状态/错误
  - 第二步：识别成功后确认提交，持久化真实任务记录并回显摘要
- 不要把“预览态”和“已创建任务态”都放进纯客户端 `useState`；至少最终任务记录必须来自持久化结果

### Library and Framework Requirements

- React Router
  - 保持当前 `7.14.x` 项目基线，不要为了本 story 升级主框架版本
  - 继续使用 route `loader/action`、`useFetcher`、错误边界和受保护路由 helpers
- React Hook Form + Zod
  - 这是架构为复杂任务创建表单指定的正式路径
  - 当前仓库尚未安装这两类依赖；Story 1.3 是第一次有充分理由引入它们
  - 若新增，优先考虑 `react-hook-form`、`zod`、`@hookform/resolvers`
- 上传解析
  - 大文件上传不要直接走裸 `request.formData()` 缓冲
  - 优先采用 React Router 官方 how-to 推荐的 `@remix-run/form-data-parser` + upload handler 方案
- TanStack Query
  - 若本 story 只是在单页内完成“预览 -> 确认 -> 回显”，`useFetcher` 与 route revalidation 足够
  - 若你把“最近创建任务”或持久化任务摘要拆成跨组件共享 server state，再按架构引入 TanStack Query，而不是手写全局状态

### Latest Technical Information

- React Router 官方 `Form` 文档当前 latest 标注为 `7.15.1`，并明确指出：
  - `<Form>` 更适合“应改变 URL 或加入 history”的提交
  - 不应改 URL 的提交应使用 `<fetcher.Form>` 或 `navigate={false}`
  - `encType=\"multipart/form-data\"` 是文件上传的正式表单编码方式  
  推论：Story 1.3 的来源预览步骤不应做导航；上传步骤必须走 multipart。
- React Router 官方 `File Uploads` how-to 明确说明：
  - `form-data-parser` 是 `request.formData()` 的流式包装
  - 大文件上传应通过 upload handler 处理
  - 表单必须设置 `multipart/form-data`  
  推论：视频上传路径不要把整文件缓冲进内存，也不要先偷懒做 DB blob。
- TanStack Query 当前官方概述持续强调它处理的是“server state”的获取、缓存、同步和更新，不是本地表单瞬时状态。  
  推论：不要把本地 intake draft 状态交给全局 query cache；只有持久化任务摘要或共享服务端结果才值得进 query 层。
- Zod 官网当前明确标注 `Zod 4 is stable`，并强调它是 TypeScript-first schema validation，推荐在 `tsconfig` 中启用 `strict`。  
  推论：如在本 story 引入 Zod，应直接按 Zod 4 路径使用，并保持现有 TypeScript 严格模式。
- React Hook Form 官方首页继续强调“performant, flexible and extensible forms”以及减少不必要重渲染。  
  推论：对于双入口、渐进暴露和内联错误较多的 intake 表单，RHF 仍然是架构指定的合理实现路线。

### Implementation Guardrails

- 不要把上传视频直接写进数据库，也不要把临时文件放进仓库静态资源目录。
- 不要为了“先跑起来”在客户端伪造成功来源、成功任务 ID 或成功提交状态。
- 不要提前实现 Story 2 的 preset 命中、字幕模板覆盖、翻译风格配置 UI；本 story 只展示当前默认处理基线摘要。
- 不要把 tasks helper 丢进 `app/shared/lib/`；来源识别、上传存储和 intake 逻辑都属于 `features/tasks`。
- 不要引入第二套认证、第二套 request context，或让 tasks action 绕开当前 `requireUserSession` / `requireRole`。
- 不要把 `task_events`、SSE、结果下载、review 流一口气做完；这里只需给它们留下真实的任务记录起点。

### Testing Requirements

- 至少覆盖以下自动化场景：
  - 匿名用户不能直接访问任务导入工作台
  - 有效 YouTube 链接可以创建草稿上下文并返回识别中/识别成功结果
  - 无效链接返回内联可消费的结构化错误
  - 文件上传缺少 `multipart/form-data`、类型不支持或大小超限时返回明确错误
  - 识别成功后确认提交会写入真实任务记录和初始状态
  - 任一关键失败响应都带 `request_id`
- 继续保留并通过：
  - `tests/auth-flow.test.ts`
  - `tests/session.test.ts`
  - `tests/api/health-route.test.mjs`
  - `tests/scaffold.test.mjs`
  - `tests/e2e/workspace-shell.test.mjs`（可更新断言，不可丢失“受保护工作台”语义）

### UX and Accessibility Guidance

- 任务导入必须是桌面工作台主行动区，而不是埋在二级面板或隐藏弹窗里。
- 交互遵循渐进暴露：
  - 先选导入方式
  - 再显示识别状态
  - 识别成功后才暴露确认摘要与最终提交动作
- 错误反馈必须以内联方式显示，避免把关键失败只做成 toast。
- 对上传中、识别中、成功、失败四类状态都要有非纯颜色表达和明确文本。
- 焦点管理、键盘操作、可读标签与 44x44 触控目标需满足现有 UX 的 WCAG AA 基线。
- 视觉方向继续使用 UX 文档选定的 `Direction 02: Process Ledger`：强调过程可解释性，而不是首页化叙事或重后台密集配置。

### Open Questions / Saved Assumptions

- 假设 1：上传视频的“来源识别”在 MVP 可以通过文件元数据、文件名规则或后端识别适配器得出；若当前条件不足以识别来源，允许以内联失败方式结束，而不是伪造成功来源。
- 假设 2：本 story 的“默认处理基线”是系统当前通用默认值，不包含频道预设命中结果；频道预设相关逻辑留到 Epic 2。
- 假设 3：若尚未接入真实对象存储，可先在 server-only 抽象后使用本地临时文件存储，但接口形状必须为后续 S3-compatible storage 预留。

### Project Structure Notes

- 保持 `routes/ + features/ + shared/ + server-only` 的组织方式：
  - `app/features/tasks/server/`
  - `app/features/tasks/ui/`
  - `app/features/tasks/schemas/`（如需要）
- 共享层只放真正跨领域复用的 UI 或工具；任务域私有逻辑不要提前全局化。
- `server-only` 文件继续使用 `.server.ts` 命名。
- 当前仓库没有 `project-context.md`；本 story 以 `epics.md`、`prd.md`、`architecture.md`、`ux-design-specification.md`、Story 1.1 和 Story 1.2 为准。

### References

- Story 定义与 AC：`_bmad-output/planning-artifacts/epics.md` → `### Story 1.3`
- 核心 FR / NFR：`_bmad-output/planning-artifacts/prd.md` → `FR1`, `FR2`, `FR3`, `FR7`, `FR8`, `NFR1`, `NFR2`, `NFR8`
- 任务主表、状态模型、表单策略、结构与错误契约：`_bmad-output/planning-artifacts/architecture.md` → `Data Architecture`, `Task Status Model`, `Form and Validation Strategy`, `Component and Route Architecture`, `API Response Formats`, `Project Organization`
- UX 方向与导入入口要求：`_bmad-output/planning-artifacts/ux-design-specification.md` → `Direction 02: Process Ledger`, `任务导入后的即时反馈区`, `桌面优先`
- 前一条 story 经验：`_bmad-output/implementation-artifacts/1-2-creator-login-and-protected-workspace-shell.md`
- 当前关键代码：
  - `app/routes/workspace.tsx`
  - `app/shared/ui/WorkspaceShell.tsx`
  - `app/app.css`
  - `database/schema/index.ts`
  - `server/app.ts`
  - `app/features/auth/server/session.server.ts`
- 官方资料：
  - React Router Form: https://reactrouter.com/api/components/Form
  - React Router Form vs. fetcher: https://reactrouter.com/explanation/form-vs-fetcher
  - React Router File Uploads: https://reactrouter.com/how-to/file-uploads
  - TanStack Query Overview: https://tanstack.com/query/latest/docs/framework/react/overview
  - Zod: https://zod.dev/
  - React Hook Form: https://www.react-hook-form.com/

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story file generated from BMAD create-story workflow.
- No `project-context.md` found during persistent fact loading.
- Source artifacts analyzed: `epics.md`, `prd.md`, `architecture.md`, `ux-design-specification.md`, Story 1.1, Story 1.2, recent commits `814aa04`, `8f02213`, `01b337c`.
- Official docs cross-check completed for React Router form/fetcher/file-upload patterns, TanStack Query server-state guidance, and Zod 4 baseline.

### Completion Notes List

- Story 1.3 context created with implementation guardrails for task intake, source recognition preview, protected workspace integration, and minimal task persistence.
- Scope intentionally excludes preset matching, full task event ledger, SSE sync, task list/detail views, and deliverable access.
- 新增 `tasks` 主表、统一任务状态定义和 `drizzle/0003_violet_harrier.sql` 迁移，`pnpm db:migrate` 已成功应用到配置数据库。
- 在受保护 `/workspace` 内完成 YouTube 链接导入、视频上传导入、来源识别预览、默认处理基线摘要、确认创建真实任务记录和最近任务摘要回显闭环。
- 新增 tasks domain 单测并更新工作台 e2e 断言，`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`、`pnpm db:migrate` 全部通过。

### File List

- `_bmad-output/implementation-artifacts/1-3-manual-task-intake-with-source-recognition-preview.md`
- `app/app.css`
- `app/routes/workspace.tsx`
- `app/shared/ui/WorkspaceShell.tsx`
- `app/features/tasks/server/source-recognition.server.ts`
- `app/features/tasks/server/task-baseline.server.ts`
- `app/features/tasks/server/task-errors.server.ts`
- `app/features/tasks/server/task-intake.server.ts`
- `app/features/tasks/server/task-status.server.ts`
- `app/features/tasks/server/upload-storage.server.ts`
- `database/schema/index.ts`
- `database/schema/tasks.ts`
- `drizzle/0003_violet_harrier.sql`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/_journal.json`
- `package.json`
- `pnpm-lock.yaml`
- `tests/e2e/workspace-shell.test.mjs`
- `tests/task-intake.test.ts`

### Change Log

- 2026-05-25: 实现 Story 1.3 的受保护任务导入闭环，包括最小任务持久化、来源识别预览、确认创建、最近任务摘要和测试验证。
