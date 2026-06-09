# Yakimoji

Yakimoji 现已完成 Epic 1 Story 1.2 的最小认证闭环：基于 React Router Framework Mode `node-postgres` 基线，提供公开登录入口、服务端 SSO 回调、本地 session、最小 RBAC、请求级 `request_id` 与受保护工作台壳层。任务、预设、review 与交付能力仍会在后续 story 中继续接入。

## Quick Start

1. 准备 Node.js `20.19+` 与 `pnpm 10.x`。
2. 复制环境变量模板：

```bash
cp .env.example .env
```

3. 在可访问 npm registry 的环境安装依赖：

```bash
pnpm install
```

4. 启动开发服务器：

```bash
pnpm dev
```

5. 访问：
   - 公开登录入口：`http://localhost:3000/login`
   - 受保护工作台：`http://localhost:3000/workspace`
   - 健康检查：`http://localhost:3000/health`

## Database and Migrations

Story 1.2 在保留 `starter_health_checks` 的基础上，新增了认证与审计最小模型：

- `users`
- `sso_accounts`
- `user_role_assignments`
- `sessions`
- `audit_logs`

浏览器 cookie 只保存 Yakimoji 本地 session 标识；真实 session 状态、角色判定与审计记录都持久化在服务端和数据库中。

本地 `http://localhost` 开发环境不会使用 `__Host-` cookie 前缀，因为浏览器只接受带 `Secure` 标记的 `__Host-` cookie；生产环境启用 HTTPS 后会自动切换到 `__Host-` 前缀。

常用命令：

```bash
pnpm db:generate
pnpm db:migrate
```

推荐本地 PostgreSQL 默认连接串：

```bash
postgres://postgres:postgres@localhost:5432/yakimoji
```

如果使用 Docker 或本机 PostgreSQL，请确保 `.env` 中的 `DATABASE_URL` 指向可写数据库，然后再执行 migration。

## Environment Variables

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境，默认 `development` | 否 |
| `DATABASE_URL` | PostgreSQL 连接串，Drizzle 与服务端都会读取 | 是 |
| `SESSION_SECRET` | Yakimoji 本地 session / SSO state cookie 签名密钥 | 是 |
| `SSO_BASE_URL` | 上游 SSO 前台授权地址，浏览器会跳转到这个地址的 `/oauth/authorize` | 是 |
| `SSO_API_BASE_URL` | 上游 SSO API 地址，服务端会调用这个地址的 `/oauth/token`、`/oauth/user`；未设置时回退到 `SSO_BASE_URL` | 否 |
| `SSO_CLIENT_ID` | SSO client id | 是 |
| `SSO_CLIENT_SECRET` | SSO client secret | 是 |
| `SSO_CALLBACK_URL` | Yakimoji SSO 回调地址，默认 `http://localhost:3000/auth/callback` | 是 |
| `SSO_PROVIDER_NAME` | 本地 SSO provider 标识，默认 `yakimoji-sso` | 否 |
| `AUTH_BOOTSTRAP_ROLE` | 仅限受控引导环境使用。设为 `creator` 时，首次 SSO 登录用户才会被自动授予创作者角色；默认留空表示必须先在本地完成授权分配 | 否 |
| `PORT` | HTTP 端口，默认 `3000` | 否 |

## Verification

无依赖下载的离线验证：

```bash
pnpm test
pnpm verify:scaffold
```

有完整依赖后的推荐验证顺序：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm dev
pnpm start
```

当前仓库已在本地完成依赖安装、类型检查、构建、离线结构测试，以及一次针对已配置 PostgreSQL 的 Drizzle 验证，因此目前已证明：

- 官方 starter 等价结构与脚本对齐
- React Router Framework Mode 公开登录入口与受保护工作台壳层
- `.server` 边界、SSO adapter、本地 session 与 Drizzle 配置
- 依赖安装、类型检查、构建与离线结构验证测试
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm start` 在显式生产模式下加载构建产物

关于官方 starter 重放验证：

- 本 story 曾在临时目录尝试复现 `npx create-react-router@latest --template remix-run/react-router-templates/node-postgres`，期间遇到过外部模板抓取失败。
- 这类失败受 GitHub 可达性、认证与网络环境影响，不应被当成 Yakimoji 工程基线的一部分。
- 当前更稳定的验收依据，是仓库内脚本、目录结构、React Router Framework Mode、Express server 边界与 Drizzle 工作流已经与目标 starter 形态对齐，并通过本地构建与验证命令证明可运行。

## Story 1.2 Scope Boundaries

以下业务能力明确不在 Story 1.2 内：

- 任务导入、状态流转、事件时间线
- 频道预设管理与自动匹配
- 低置信度 review 工作流
- Deliverable 生成、授权下载与审计

当前实现只证明“SSO 身份 -> Yakimoji 本地 session -> 本地 RBAC -> 受保护工作台 -> 最小审计”的闭环成立，不应被视为任务域或交付域已经可用。

## Codex Hook 说明

这个项目把 Codex 的 `Stop` hook 配置放在 [`.codex/hooks.json`](./.codex/hooks.json)。
这里故意通过仓库内的包装脚本 [`.codex/hooks/stop-hook.sh`](./.codex/hooks/stop-hook.sh) 作为入口，这样 Codex 配置就可以跟随项目，在不同机器上保持可移植。

这个包装脚本会在运行时解析项目根目录，然后再调用当前仓库里的 BMAD `story-automator` hook 脚本。

Claude 的 hook 配置独立放在 `.claude/settings.json`。
那个文件仍然可能使用绝对路径，因为 `bmad-story-automator` 的安装逻辑会把 Claude 的 hook 命令规范化成绝对路径。
