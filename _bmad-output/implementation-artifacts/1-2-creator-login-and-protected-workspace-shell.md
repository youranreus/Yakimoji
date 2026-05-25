# Story 1.2: Creator Login and Protected Workspace Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者，
I want 通过 SSO 登录并进入受保护的工作台壳层，
so that 我可以安全访问只属于我的任务工作区。

## Acceptance Criteria

1. **Given** 用户尚未登录且访问受保护的工作台路由  
   **When** 用户进入任务工作台入口  
   **Then** 系统必须将其重定向到 SSO 登录流程或返回受保护访问所需的未认证响应  
   **And** 未认证用户不能看到任何任务、交付物或支持视图数据
2. **Given** 用户已通过 SSO 完成身份认证  
   **When** Yakimoji 服务端完成 token 交换并拉取用户资料  
   **Then** 系统必须在服务端创建或关联本地用户与 SSO 账户映射  
   **And** 浏览器只持有 Yakimoji 自己签发的 HttpOnly、Secure session cookie，而不直接持有上游 SSO access token
3. **Given** 用户首次或再次成功登录  
   **When** 系统建立本地登录态  
   **Then** 系统必须基于本地 RBAC 分配该用户在 Yakimoji 内的可访问范围  
   **And** 上游 SSO 的粗粒度角色不能直接作为 Yakimoji 资源授权真源
4. **Given** 用户已登录并访问工作台  
   **When** 页面加载受保护的工作台壳层  
   **Then** 用户必须看到桌面优先的基础工作台框架，包括全局导航、主内容区和登录态上下文  
   **And** 该壳层不依赖未来 story 才能正常显示受保护页面基础结构
5. **Given** 已登录用户尝试访问不属于其权限范围的受保护资源或页面  
   **When** 授权检查执行  
   **Then** 系统必须返回 403 或 404，且越权访问成功率为 0  
   **And** 系统必须记录请求主体、目标资源标识和拒绝时间戳用于审计
6. **Given** 用户从浏览器发起受保护请求  
   **When** 请求进入 Yakimoji 后端  
   **Then** 系统必须能把请求与本地 session 和用户身份关联  
   **And** 关键失败响应应保留可追踪的 request_id 以支持排障

## Tasks / Subtasks

- [x] 建立 Story 1.2 所需的最小认证与审计数据模型，并通过 Drizzle migration 落库 (AC: 2, 3, 5, 6)
  - [x] 在 `database/schema/` 中从当前单文件最小 schema 演进到可维护的 auth/audit schema 结构，至少补齐 `users`、`sso_accounts`、`user_role_assignments`、`sessions`、`audit_logs` 的 MVP 字段与索引
  - [x] 保留 Story 1.1 的 `starter_health_checks` 证明性表，不要删除已有 migration 历史
  - [x] 生成并提交新的 `drizzle/*.sql` 与 `drizzle/meta/*`，继续沿用 `pnpm db:generate` / `pnpm db:migrate`
- [x] 在 server-only 边界内实现 SSO adapter、本地 session 和 request context (AC: 1, 2, 3, 6)
  - [x] 用真实实现替换 `app/features/auth/server/session.server.ts` 占位抛错，封装 session 创建、读取、续期、销毁与当前用户解析
  - [x] 新增 `sso-adapter.server.ts` 或等价模块，把 `authorize -> token -> user` 三步全部封装在服务端，不引入黑盒 OIDC 中间件
  - [x] 增加 request context / request id 生成与透传能力，保证关键错误与拒绝响应可追踪
  - [x] 扩展 `app/server/env.server.ts` 与 `.env.example`，补齐 `SESSION_SECRET`、SSO base URL / client credentials / callback URL 等 Story 1.2 真正需要的环境变量
- [x] 实现登录入口、回调处理、登出与受保护路由守卫 (AC: 1, 2, 3, 5, 6)
  - [x] 在 React Router 路由树中加入公开登录入口和 SSO 回调路由，建议保留 `/health` 为公开路由
  - [x] 将受保护工作台入口改为必须先通过 session 检查；未登录用户统一 redirect 到登录流或返回 401/403
  - [x] 在登录成功后创建或关联本地 `users` + `sso_accounts` 记录，并基于本地 `user_role_assignments` 决定访问范围
  - [x] 提供登出能力，确保本地 session 可以显式失效
- [x] 落地本地 RBAC 判定与最小审计闭环 (AC: 3, 5, 6)
  - [x] 角色体系至少对齐 `creator`、`support`、`ops`、`admin` 四层，但本 story 只需确保 `creator` 受保护工作台入口闭环
  - [x] 明确实现“SSO role 不是授权真源”：上游 `role=0/1` 只能作为映射输入或辅助信号，不能直接替代 Yakimoji 本地角色判断
  - [x] 对越权页面/资源访问写入最小审计记录，至少包含 `request_id`、请求主体、目标资源标识、拒绝结果与时间戳
- [x] 将当前基线工作台壳层演进为登录后可用的受保护壳层 (AC: 4, 6)
  - [x] 在现有 `WorkspaceShell` 基础上保留桌面优先、克制可信的工作台气质，补齐全局导航、主内容区、登录态上下文和基础 account affordance
  - [x] 该壳层必须可以独立展示，不依赖后续任务列表、预设、review、deliverable story 才能成立
  - [x] 对未授权、会话失效和关键加载失败提供结构化错误表达，而不是只给空白页或 toast
- [x] 补齐 Story 1.2 的测试、验证和文档 (AC: 1, 2, 5, 6)
  - [x] 在现有 `tests/api` 和 `tests/e2e` 模式下新增 auth/session 相关测试，覆盖未登录访问、回调建 session、登出失效、越权拒绝、`request_id` 可见性
  - [x] 保持 Story 1.1 现有 `/health`、scaffold、README 契约测试继续通过，不允许 auth 改动回归这些基线
  - [x] 至少运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm db:generate`、`pnpm db:migrate`

## Dev Notes

### Story Intent

- 这不是“把一个登录按钮放到页面上”的 story，而是 Yakimoji 第一条真正受保护的产品主路径。
- Story 1.2 需要把“SSO 身份 -> 本地 session -> 本地 RBAC -> 受保护工作台壳层 -> 审计追踪”串成完整闭环，为后续任务、预设、review、deliverable story 提供真实依赖基础。
- 本 story 只需交付“登录后能安全进入工作台壳层”的闭环，不要提前实现任务列表、任务详情、预设管理、review 队列或下载能力。

### Epic Context

- Epic 1 的目标是让创作者可以安全登录工作台，手动导入任务、查看状态并拿到首个可交付结果；Story 1.2 是这条主链路的入口关卡。
- Epic 1 后续故事对 Story 1.2 的直接依赖：
  - Story 1.3 需要在已认证工作台中承载手动任务导入入口
  - Story 1.5/1.6 需要复用这里建立的受保护壳层、session 关联和 request context
  - Story 1.7 需要复用这里建立的授权边界和审计模式

### Previous Story Intelligence

- Story 1.1 明确只做 starter 与工程地基，`app/features/auth/server/session.server.ts` 目前故意抛错，提醒 auth/session 只能在 Story 1.2 的 server-only 边界内实现。
- Story 1.1 把仓库对齐到了 React Router Framework Mode + Express + PostgreSQL + Drizzle 基线；Story 1.2 必须扩展这套骨架，而不是再引入另一套认证框架或另起一层服务。
- Story 1.1 的 review follow-up 已修复两类容易被 auth 改动重新破坏的基线：
  - 缺失 `DATABASE_URL` 时应用不能在启动期整体崩溃，`/health` 仍应可访问
  - Drizzle migration 产物必须进版本控制，不能被 `.gitignore` 吞掉
- 当前 README 已明确声明没有真实 auth 能力；Story 1.2 完成后要同步更新文档，避免 repo 说明与实际实现脱节。

### Git Intelligence Summary

- 最近相关提交模式表明仓库偏好“最小闭环 + 明确边界 + 结构化测试”，而不是先堆大量 feature 再补验证：
  - `cfd123d` 初始化 Story 1.1 scaffold baseline，建立了 `app/features/auth/server/`、`server/`、`database/`、`tests/api/`、`tests/e2e/` 的基础布局
  - `269c72a` 修正了运行模式、README 与测试契约，说明后续 story 必须对启动路径、文档与测试结果保持诚实
- 当前代码库没有用户未提交改动；Story 1.2 可以按既有边界直接推进。

### Architecture Compliance

- 身份与授权边界是硬约束：
  - `SSO 负责身份认证`
  - `Yakimoji 负责本地会话`
  - `Yakimoji 负责应用授权`
  - `外部 API 使用独立凭证体系`
- 浏览器不能持有上游 SSO token；token exchange 与 `/oauth/user` 调用必须全部留在服务端。
- 上游 SSO `role=0/1` 不能直接当成 Yakimoji 最终授权；Yakimoji 的授权真源是本地 `user_role_assignments`。
- 本地 RBAC 至少保留 `creator`、`support`、`ops`、`admin` 四层；本 story 的最小闭环是 `creator`。
- 所有高敏感授权检查必须集中、可追踪，不能在多个 route / component 中复制散落的 role 判断。

### Current Codebase State and Files to Update

- `app/features/auth/server/session.server.ts`
  - 当前状态：只有 `assertSessionBoundary()` 抛错占位，没有 session storage、cookie、当前用户解析、登出逻辑
  - 本 story 要改：替换为真实 session 管理入口，提供 `requireUserSession`、`getOptionalUserSession`、`commitSession`、`destroySession` 等能力
  - 必须保留：server-only 边界，不让任何 secret、SSO token 或签名逻辑泄漏到客户端 bundle
- `app/routes.ts`
  - 当前状态：只有 `index("routes/home.tsx")` 与公开 `health` 路由
  - 本 story 要改：补齐公开 auth 路由与受保护工作台路由层级，建议引入受保护 layout route
  - 必须保留：`/health` 公开可访问
- `app/routes/home.tsx`
  - 当前状态：公开 baseline loader，返回 `runtime/serviceName/pendingDomains/boundaries`
  - 本 story 要改：不要继续把这里当作匿名首页；可改为登录页、登录后重定向，或拆分成 `/login` 与受保护工作台页
  - 必须保留：现有基线信息如果被迁移到其他页面，测试也要同步更新，不要留下死文案
- `app/shared/ui/WorkspaceShell.tsx`
  - 当前状态：纯展示型 baseline shell，没有导航、账号上下文或受保护区域语义
  - 本 story 要改：演进成真实登录后壳层组件，能承载导航、用户身份、主内容插槽与错误状态
  - 必须保留：桌面优先、克制、可信的工作台气质，不要做成营销首页或嘈杂后台
- `app/root.tsx`
  - 当前状态：只提供文档骨架与基础错误边界
  - 本 story 要改：必要时增强根级错误可观测性，但不要破坏 `lang="zh-CN"`、基本错误壳层与现有页面结构
  - 必须保留：错误场景要可显示，不允许因为 auth 重定向或 loader 抛错变成白屏
- `app/server/env.server.ts`
  - 当前状态：只读取 `NODE_ENV` 和 `DATABASE_URL`
  - 本 story 要改：补齐 session/SSO 所需 env reader，并区分“启动期可选”和“受保护 auth 路径必需”的变量
  - 必须保留：不要重新引入启动期因缺失 `DATABASE_URL` 直接崩溃的回归
- `server/app.ts`
  - 当前状态：建立 Express + DatabaseContext + React Router request handler
  - 本 story 要改：增加 request id、中间件级 request context，必要时让 load context 能读取 request-scoped metadata
  - 必须保留：DatabaseContext 注入模式与 `/health` 路由可用性
- `database/schema/index.ts`
  - 当前状态：只有 `starter_health_checks`
  - 本 story 要改：拆分或扩展 auth / audit 所需表定义，并与 migration 同步
  - 必须保留：已有 starter 验证表和迁移历史

### Recommended Route and Module Shape

- 推荐路由形态：
  - `/login`：公开登录入口
  - `/auth/callback`：SSO 回调处理
  - `/logout`：登出动作或路由
  - `/workspace`：受保护工作台壳层
  - `/`：根据 session 决定跳转到 `/workspace` 或 `/login`
  - `/health`：公开健康检查
- 推荐模块形态：
  - `app/features/auth/server/session.server.ts`
  - `app/features/auth/server/sso-adapter.server.ts`
  - `app/features/auth/server/authz.server.ts`
  - `app/features/auth/server/audit.server.ts`
  - `app/features/auth/server/request-context.server.ts`
  - `app/features/auth/ui/` 下放登录态 UI 或壳层子组件

### Data Model Guidance

- `users`
  - 保存 Yakimoji 本地用户主体；不要把上游返回直接当成唯一用户表结构
- `sso_accounts`
  - 保存 provider、provider user id、必要元数据与 `users` 映射
- `user_role_assignments`
  - 保存 Yakimoji 本地角色事实；不要把本地角色写死在 `users.role` 单字段后失去扩展性
- `sessions`
  - 保存本地 session 状态；建议浏览器 cookie 只存 opaque session id，不把完整角色和 SSO token 放进 cookie
- `audit_logs`
  - 本 story 只需支撑认证/授权拒绝、登录、登出等最小安全审计，不要一次做成全量运营审计平台

### Library and Framework Requirements

- 保持现有 React Router Framework Mode，不要引入另一个前端路由体系。
- 保持现有 Express + React Router request handler 结构，不要额外包一层自定义全栈框架。
- 不要引入通用 OIDC 黑盒中间件来“猜”当前 SSO 协议。架构已经明确当前协议更适合显式 `SSO adapter`。
- 优先复用 React Router 自带的 session/cookie 能力与 loader/action 模式；不要为了 auth 额外引入重量级认证框架。
- 继续使用 PostgreSQL + Drizzle + SQL migration 链路，不要在本 story 内切 ORM、切数据库或改为 schema push-only 流程。

### Latest Technical Information

- React Router 官方的 “Sessions and Cookies” 文档（近两周抓取）强调：在 framework 模式下，session 应在 route `loader` / `action` 内按路由处理，而不是依赖 Express middleware 魔法；这与当前项目的 route-first 架构一致。  
  关键推论：Yakimoji 应把“读 session -> 取当前用户 -> 做授权 -> 决定 redirect / render”放在受保护 route loader 或共享 server helper 中。
- React Router 官方 `createCookieSessionStorage` 文档说明它会把 session 数据直接存进 cookie。  
  关键推论：Yakimoji 既然要求本地 `sessions` 表、显式失效和审计，就不应把完整 session / RBAC 状态直接塞进 cookie；更适合“cookie 里只放会话标识，服务端持久化 session 状态”。
- Drizzle 官方 migration 文档（近一周抓取）继续推荐 code-first 流程：以 TypeScript schema 为真源，用 `drizzle-kit generate` 生成 SQL migration，再用 `drizzle-kit migrate` 应用。  
  关键推论：Story 1.2 需要继续提交 schema + SQL + snapshot，不要跳过 migration 文件直接手改数据库。
- MDN 当前 cookie 安全指南明确建议：会话标识 cookie 应显式使用 `Secure`、`HttpOnly`，并尽可能采用 `__Host-` 前缀、`Path=/`、无 `Domain` 属性；同时 `SameSite=None` 必须配合 `Secure`。  
  关键推论：Yakimoji 的本地 session cookie 推荐采用 `__Host-` 命名和显式安全属性；若登录回跳是常规顶级导航，优先评估 `SameSite=Lax`，不要默认放宽到 `None`。

### Implementation Guardrails

- 不要把上游 access token 写入浏览器、`localStorage`、`sessionStorage` 或可序列化到客户端的 loader payload。
- 不要在多个组件里硬编码角色判断；所有 authz 必须集中到 server helper。
- 不要因为要做 auth 而删除或绕过 `DatabaseContext`；后续 stories 也需要这条 request-scoped DB 获取路径。
- 不要让 auth loader 在全局无差别触发数据库必需逻辑，导致 `/health` 或未认证公开路由在缺 DB 配置时直接崩溃。
- 不要把工作台壳层做成“等后续 story 才能显示内容”的空页面。即使业务数据尚未接入，壳层本身也要完整表达登录态、导航与主内容结构。
- 不要一次性提前实现外部 API credential 鉴权、交付物签名下载、任务级资源授权全量矩阵；本 story 只建立 Web 登录态与最小 RBAC/审计闭环。

### Testing Requirements

- 新增自动化覆盖至少包括：
  - 未登录访问受保护工作台会被 redirect 或得到明确 401/403
  - SSO 回调成功后会建立本地用户 / 映射 / session，并返回安全 cookie
  - 浏览器侧永远拿不到上游 token，只能拿到 Yakimoji session cookie
  - 已登录但无权访问时返回 403/404，且响应可关联 `request_id`
  - 拒绝访问会写入最小审计记录
  - 登出后原 session 不再可访问受保护路由
- 保留并继续通过现有基线测试：
  - `tests/api/health-route.test.mjs`
  - `tests/e2e/workspace-shell.test.mjs`（可以按 story 新行为更新断言，但要保留“工作台型应用”意图）
  - `tests/scaffold.test.mjs`
  - `tests/readme.test.mjs`
- 若为 session helper 写更细粒度测试，优先沿用当前 `node:test` + `loadTransformedModule` 模式，而不是新引入整套测试框架。

### UX and Shell Guidance

- 工作台气质必须延续 UX 文档的“可靠、克制、秩序感明确”方向，不做营销首页，也不做重后台。
- 受保护壳层首屏优先服务桌面端：清楚导航、主内容区、登录态上下文和系统状态，而不是大量配置表单。
- 错误反馈要可解释，关键失败场景要让用户和支持能看到 `request_id` 或等价追踪标识。
- 移动端在本 story 只需不破坏基础可读性和关键入口，不需要完整移动工作流。

### Project Structure Notes

- 继续遵循 `routes/ + features/ + shared/ + server-only` 的结构，不要回退到 `components/ pages/ utils/` 大平铺。
- 领域私有 helper 留在 `features/auth/`，不要一开始就塞进 `shared/lib/`。
- server-only 文件统一使用 `.server.ts` 命名，保持边界清晰。
- 当前仓库没有 `project-context.md`；本 story 的上下文以 `epics.md`、`prd.md`、`architecture.md`、`ux-design-specification.md` 与 Story 1.1 产物为准。

### References

- Story 1.2 定义与验收标准：`_bmad-output/planning-artifacts/epics.md` → `## Epic 1` / `### Story 1.2`
- FR / NFR 约束：`_bmad-output/planning-artifacts/prd.md` → `FR8`, `NFR1`, `NFR7`, `NFR8`, `NFR10`, `NFR11`, `NFR12`
- SSO、session、RBAC、审计与 API 边界：`_bmad-output/planning-artifacts/architecture.md` → `ADR: SSO Identity Boundary and Local Authorization Model`, `Session Strategy`, `Local RBAC Model`, `Data Model Implications`
- 路由/目录/测试/错误模式：`_bmad-output/planning-artifacts/architecture.md` → `Component and Route Architecture`, `API Response Formats`, `Project Organization`, `Testing Structure`, `Error Handling Patterns`, `Authentication Flow Patterns`
- 工作台气质与桌面优先 UX：`_bmad-output/planning-artifacts/ux-design-specification.md` → `Design System Foundation`, `Direction 02: Process Ledger`, `桌面优先`相关章节
- 上一条 story 经验：`_bmad-output/implementation-artifacts/1-1-initialize-the-product-from-the-approved-starter-template.md`
- 当前占位代码：
  - `app/features/auth/server/session.server.ts`
  - `app/routes.ts`
  - `app/routes/home.tsx`
  - `app/shared/ui/WorkspaceShell.tsx`
  - `app/server/env.server.ts`
  - `server/app.ts`
- 外部官方资料：
  - React Router Sessions and Cookies: https://reactrouter.com/explanation/sessions-and-cookies
  - React Router `createCookieSessionStorage`: https://reactrouter.com/api/utils/createCookieSessionStorage
  - Drizzle migrations fundamentals: https://orm.drizzle.team/docs/migrations
  - Drizzle Kit `generate`: https://orm.drizzle.team/docs/drizzle-kit-generate
  - Drizzle Kit `migrate`: https://orm.drizzle.team/docs/drizzle-kit-migrate
  - MDN cookie security guide: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies
  - MDN Set-Cookie reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story selected automatically from `sprint-status.yaml` as the first backlog story after Story 1.1.
- No `project-context.md` was found in the repository during persistent fact loading.
- Story context synthesized from `epics.md`, `prd.md`, `architecture.md`, `ux-design-specification.md`, Story 1.1 artifact, current repository files, recent git history, and official documentation.
- Updated `sprint-status.yaml` to mark Story 1.2 as `in-progress` before implementation and moved it to `review` after validation.
- Reworked auth persistence from a single placeholder file into Drizzle-backed `users`, `sso_accounts`, `user_role_assignments`, `sessions`, and `audit_logs` tables plus generated `drizzle/0002_chubby_jackpot.sql`.
- Added request-scoped `request_id` propagation in the Express boundary and surfaced it through protected route errors and audit records.
- Replaced the Story 1.1 auth placeholder with a server-only session manager, explicit SSO adapter, local RBAC guard, and logout flow.
- Added public `/login`, `/auth/callback`, `/logout`, protected `/workspace`, and root redirect behavior while keeping `/health` public.
- Expanded the workspace shell into a protected desktop-first shell with navigation, identity context, structured support metadata, and authorization-aware error states.
- Added auth/session tests in `tests/auth-flow.test.ts` and `tests/session.test.ts`, and updated existing scaffold/README/e2e tests to the new Story 1.2 contract.
- Validation results: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate` passed locally.
- `pnpm db:migrate` failed in the sandbox with `connect EPERM 9.134.57.221:5432`, so migration application against the configured external PostgreSQL instance could not be completed from this environment.

### Completion Notes List

- Implemented a complete Story 1.2 auth baseline on top of the existing React Router + Express + Drizzle scaffold without introducing a parallel auth framework.
- Added server-only SSO authorize/token/user orchestration, signed SSO state handling, local session issuance, session invalidation, and current-user resolution.
- Enforced the `SSO identity -> Yakimoji local session -> Yakimoji local RBAC` separation explicitly, with browser cookies carrying only Yakimoji session state.
- Added request-scoped `request_id` generation and propagation so protected failures and audit writes can be correlated.
- Implemented local RBAC for the `creator` workspace path and minimal audit logging for provisioning, login, logout, and authorization denial.
- Evolved the baseline workspace shell into a protected desktop-first shell with navigation, identity context, request traceability, and structured denied-state rendering.
- Added automated coverage for login redirect, SSO callback session creation, secure cookie behavior, logout invalidation, unauthorized access denial, and `request_id` visibility.
- Updated README, environment template, scaffold verification, and baseline tests to reflect the new protected workspace contract.
- Verification completed successfully for `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:generate`.
- `pnpm db:migrate` remains pending outside the sandbox because the configured PostgreSQL host was not reachable from this environment.

### File List

- `_bmad-output/implementation-artifacts/1-2-creator-login-and-protected-workspace-shell.md`
- `.env.example`
- `README.md`
- `app/app.css`
- `app/features/auth/server/audit.server.ts`
- `app/features/auth/server/auth-flow.server.ts`
- `app/features/auth/server/authz.server.ts`
- `app/features/auth/server/request-context.server.ts`
- `app/features/auth/server/session.server.ts`
- `app/features/auth/server/sso-adapter.server.ts`
- `app/routes.ts`
- `app/routes/auth.callback.tsx`
- `app/routes/home.tsx`
- `app/routes/login.tsx`
- `app/routes/logout.tsx`
- `app/routes/workspace.tsx`
- `app/server/env.server.ts`
- `app/shared/ui/WorkspaceShell.tsx`
- `database/schema/auth.ts`
- `database/schema/health.ts`
- `database/schema/index.ts`
- `drizzle/0002_chubby_jackpot.sql`
- `drizzle/meta/0002_snapshot.json`
- `drizzle/meta/_journal.json`
- `package.json`
- `server/app.ts`
- `tests/api/health-route.test.mjs`
- `tests/auth-flow.test.ts`
- `tests/e2e/workspace-shell.test.mjs`
- `tests/readme.test.mjs`
- `tests/scaffold.test.mjs`
- `tests/session.test.ts`
- `tests/verify-scaffold.mjs`

### Change Log

- 2026-05-22: Implemented Story 1.2 protected workspace auth/session/RBAC/audit baseline and generated auth schema migration.
