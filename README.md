# Yakimoji

Yakimoji 现已对齐到 Epic 1 Story 1.1 要求的 React Router Framework Mode `node-postgres` 工程基线。当前仓库只提供最小可运行工作台壳层、Express server 边界，以及 PostgreSQL + Drizzle migration 链路入口，不包含登录、任务、预设、review 或交付能力实现。

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
   - 工作台壳层：`http://localhost:3000/`
   - 健康检查：`http://localhost:3000/health`

## Database and Migrations

Story 1.1 只建立 Drizzle migration 能力，不预建业务域表。当前最小 schema 为 `starter_health_checks`，用于证明 Drizzle -> PostgreSQL 链路已接通。

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
pnpm db:generate
pnpm db:migrate
pnpm dev
```

当前仓库已在本地完成依赖安装、类型检查、构建、离线结构测试，以及一次针对已配置 PostgreSQL 的 Drizzle 验证，因此目前已证明：

- 官方 starter 等价结构与脚本对齐
- React Router Framework Mode 最小入口与路由壳
- `.server` 边界与 Drizzle 配置
- 依赖安装、类型检查、构建与离线结构验证测试
- `pnpm db:generate`
- `pnpm db:migrate`

尚未完全补齐的只剩一项证据：

- 使用 `npx create-react-router@latest --template remix-run/react-router-templates/node-postgres` 在临时目录重放官方 starter 初始化。当前尝试在 GitHub 模板抓取阶段返回了 `403`，因此这一步还没有形成可重复证据。

这不影响当前仓库已经通过的数据库 migration 验证，但 Story 1.1 仍保留这一未闭合项以便后续补证。

## Story 1.1 Scope Boundaries

以下业务能力明确不在 Story 1.1 内：

- Creator 登录与受保护工作台
- 任务导入、状态流转、事件时间线
- 频道预设管理与自动匹配
- 低置信度 review 工作流
- Deliverable 生成、授权下载与审计

当前代码中的 `app/features/*` 与 `app/features/auth/server/session.server.ts` 仅作为后续故事的边界占位，不应被视为已实现能力。

## Codex Hook 说明

这个项目把 Codex 的 `Stop` hook 配置放在 [`.codex/hooks.json`](./.codex/hooks.json)。
这里故意通过仓库内的包装脚本 [`.codex/hooks/stop-hook.sh`](./.codex/hooks/stop-hook.sh) 作为入口，这样 Codex 配置就可以跟随项目，在不同机器上保持可移植。

这个包装脚本会在运行时解析项目根目录，然后再调用当前仓库里的 BMAD `story-automator` hook 脚本。

Claude 的 hook 配置独立放在 `.claude/settings.json`。
那个文件仍然可能使用绝对路径，因为 `bmad-story-automator` 的安装逻辑会把 Claude 的 hook 命令规范化成绝对路径。
